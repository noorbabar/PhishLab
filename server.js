const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./phishbox.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT 1
  )`);

  // Targets table
  db.run(`CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Campaign results table
  db.run(`CREATE TABLE IF NOT EXISTS campaign_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    target_id INTEGER,
    token TEXT UNIQUE,
    email_sent BOOLEAN DEFAULT 0,
    link_clicked BOOLEAN DEFAULT 0,
    credentials_entered BOOLEAN DEFAULT 0,
    clicked_at DATETIME,
    data_entered_at DATETIME,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id),
    FOREIGN KEY (target_id) REFERENCES targets (id)
  )`);

  // Training modules table
  db.run(`CREATE TABLE IF NOT EXISTS training_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert default training module
  db.run(`INSERT OR IGNORE INTO training_modules (id, title, content) VALUES (
    1,
    'Phishing Awareness Training',
    'You have been part of a phishing simulation. Here are key signs to watch for:\n\n1. Suspicious sender addresses\n2. Urgent or threatening language\n3. Unexpected attachments or links\n4. Requests for sensitive information\n5. Poor grammar or spelling\n\nAlways verify requests through official channels before taking action.'
  )`);
});

// Email configuration (customize with your SMTP settings)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Phishing email templates
const templates = {
  invoice: {
    subject: 'Urgent: Invoice Payment Required',
    html: `
      <h2>Invoice Payment Notice</h2>
      <p>Dear {{name}},</p>
      <p>Your invoice #{{invoice_id}} is overdue. Please click the link below to make payment immediately:</p>
      <p><a href="{{phish_url}}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none;">Pay Now</a></p>
      <p>Failure to pay within 24 hours may result in service suspension.</p>
      <p>Best regards,<br>Billing Department</p>
    `
  },
  login: {
    subject: 'Security Alert: Verify Your Account',
    html: `
      <h2>Account Security Alert</h2>
      <p>Hello {{name}},</p>
      <p>We detected unusual activity on your account. Please verify your identity immediately:</p>
      <p><a href="{{phish_url}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none;">Verify Account</a></p>
      <p>This link will expire in 2 hours for security reasons.</p>
      <p>Security Team</p>
    `
  }
};

// API Routes

// Get dashboard stats
app.get('/api/dashboard', (req, res) => {
  db.serialize(() => {
    let stats = {};
    
    db.get('SELECT COUNT(*) as total FROM targets', (err, row) => {
      stats.totalTargets = row.total;
      
      db.get('SELECT COUNT(*) as total FROM campaigns WHERE active = 1', (err, row) => {
        stats.activeCampaigns = row.total;
        
        db.get('SELECT COUNT(*) as total FROM campaign_results WHERE link_clicked = 1', (err, row) => {
          stats.clickedLinks = row.total;
          
          db.get('SELECT COUNT(*) as total FROM campaign_results WHERE credentials_entered = 1', (err, row) => {
            stats.enteredCredentials = row.total;
            res.json(stats);
          });
        });
      });
    });
  });
});

// Get all targets
app.get('/api/targets', (req, res) => {
  db.all('SELECT * FROM targets ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add new target
app.post('/api/targets', (req, res) => {
  const { email, name, department } = req.body;
  
  db.run('INSERT INTO targets (email, name, department) VALUES (?, ?, ?)', 
    [email, name, department], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Target added successfully' });
  });
});

// Get all campaigns
app.get('/api/campaigns', (req, res) => {
  db.all('SELECT * FROM campaigns ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create new campaign
app.post('/api/campaigns', (req, res) => {
  const { name, template, targetIds } = req.body;
  
  db.run('INSERT INTO campaigns (name, template) VALUES (?, ?)', 
    [name, template], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    const campaignId = this.lastID;
    
    // Create campaign results for each target
    targetIds.forEach(targetId => {
      const token = crypto.randomBytes(32).toString('hex');
      db.run('INSERT INTO campaign_results (campaign_id, target_id, token) VALUES (?, ?, ?)',
        [campaignId, targetId, token]);
    });
    
    res.json({ id: campaignId, message: 'Campaign created successfully' });
  });
});

// Send phishing emails
app.post('/api/campaigns/:id/send', (req, res) => {
  const campaignId = req.params.id;
  
  db.all(`
    SELECT cr.token, t.email, t.name, c.template, c.name as campaign_name
    FROM campaign_results cr
    JOIN targets t ON cr.target_id = t.id
    JOIN campaigns c ON cr.campaign_id = c.id
    WHERE cr.campaign_id = ? AND cr.email_sent = 0
  `, [campaignId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    rows.forEach(row => {
      const template = templates[row.template];
      const phishUrl = `${req.protocol}://${req.get('host')}/phish/${row.token}`;
      
      const html = template.html
        .replace(/{{name}}/g, row.name)
        .replace(/{{phish_url}}/g, phishUrl)
        .replace(/{{invoice_id}}/g, Math.floor(Math.random() * 10000));
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'security@company.com',
        to: row.email,
        subject: template.subject,
        html: html
      };
      
     transporter.sendMail(mailOptions, (error, info) => {
       if (!error) {
           db.run('UPDATE campaign_results SET email_sent = 1 WHERE token = ?', [row.token]);
       }
      });
      
      db.run('UPDATE campaign_results SET email_sent = 1 WHERE token = ?', [row.token]);
    });
    
    res.json({ message: `Emails sent to ${rows.length} targets` });
  });
});

// Phishing landing page
app.get('/phish/:token', (req, res) => {
  const token = req.params.token;
  
  // Log the click
  db.run(`UPDATE campaign_results 
          SET link_clicked = 1, clicked_at = CURRENT_TIMESTAMP, 
              ip_address = ?, user_agent = ?
          WHERE token = ?`, 
    [req.ip, req.get('User-Agent'), token], (err) => {
    
    // Serve fake login page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Verification</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; }
          input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
          .alert { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="alert">
          <strong>Security Alert:</strong> Please verify your account immediately.
        </div>
        <form id="phishForm">
          <div class="form-group">
            <label>Email:</label>
            <input type="email" name="email" required>
          </div>
          <div class="form-group">
            <label>Password:</label>
            <input type="password" name="password" required>
          </div>
          <button type="submit">Verify Account</button>
        </form>
        
        <script>
          document.getElementById('phishForm').onsubmit = function(e) {
            e.preventDefault();
            
            // Log credential entry
            fetch('/api/phish/${token}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: e.target.email.value,
                password: '***hidden***'
              })
            });
            
            // Redirect to training
            window.location.href = '/training/${token}';
          };
        </script>
      </body>
      </html>
    `);
  });
});

// Handle credential submission
app.post('/api/phish/:token', (req, res) => {
  const token = req.params.token;
  
  db.run(`UPDATE campaign_results 
          SET credentials_entered = 1, data_entered_at = CURRENT_TIMESTAMP
          WHERE token = ?`, [token], (err) => {
    res.json({ success: true });
  });
});

// Training page
app.get('/training/:token', (req, res) => {
  const token = req.params.token;
  
  db.get('SELECT * FROM training_modules WHERE id = 1', (err, training) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Security Training</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
          .content { line-height: 1.6; }
          .btn { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="warning">
          <strong>⚠️ You have been part of a phishing simulation!</strong>
        </div>
        <div class="content">
          <h2>${training.title}</h2>
          <p>${training.content.replace(/\n/g, '<br>')}</p>
          <button class="btn" onclick="window.close()">Complete Training</button>
        </div>
      </body>
      </html>
    `);
  });
});

// Get campaign results
app.get('/api/campaigns/:id/results', (req, res) => {
  const campaignId = req.params.id;
  
  db.all(`
    SELECT t.name, t.email, t.department,
           cr.email_sent, cr.link_clicked, cr.credentials_entered,
           cr.clicked_at, cr.data_entered_at, cr.ip_address
    FROM campaign_results cr
    JOIN targets t ON cr.target_id = t.id
    WHERE cr.campaign_id = ?
    ORDER BY t.name
  `, [campaignId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Serve admin dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PhishBox server running on port ${PORT}`);
  console.log(`Access dashboard at: http://localhost:${PORT}`);
});