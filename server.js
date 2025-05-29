const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
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
  // Users table (employees)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Training modules table
  db.run(`CREATE TABLE IF NOT EXISTS training_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    module_type TEXT NOT NULL, -- 'lesson', 'quiz', 'simulation'
    difficulty TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Quiz questions table
  db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER,
    question TEXT NOT NULL,
    options TEXT NOT NULL, -- JSON array of options
    correct_answer INTEGER NOT NULL, -- index of correct answer
    explanation TEXT,
    FOREIGN KEY (module_id) REFERENCES training_modules (id)
  )`);

  // Phishing simulations table
  db.run(`CREATE TABLE IF NOT EXISTS phishing_simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    email_template TEXT NOT NULL, -- HTML template
    landing_page TEXT NOT NULL, -- HTML template
    difficulty TEXT DEFAULT 'beginner',
    red_flags TEXT, -- JSON array of red flags to identify
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // User progress table
  db.run(`CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    module_id INTEGER,
    completed BOOLEAN DEFAULT 0,
    score INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (module_id) REFERENCES training_modules (id)
  )`);

  // Simulation results table
  db.run(`CREATE TABLE IF NOT EXISTS simulation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    simulation_id INTEGER,
    fell_for_phish BOOLEAN DEFAULT 0,
    identified_red_flags TEXT, -- JSON array of identified flags
    time_taken INTEGER, -- seconds
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (simulation_id) REFERENCES phishing_simulations (id)
  )`);

  // Insert default training modules
  db.run(`INSERT OR IGNORE INTO training_modules (id, title, content, module_type, difficulty) VALUES 
    (1, 'Introduction to Phishing', 'Learn what phishing is and why it''s dangerous. Phishing is a cyber attack where criminals impersonate legitimate organizations to steal sensitive information like passwords, credit card numbers, and personal data.', 'lesson', 'beginner'),
    (2, 'Common Phishing Red Flags', 'Learn to identify suspicious emails and messages. Key warning signs include urgent language, suspicious sender addresses, unexpected attachments, requests for sensitive information, and poor grammar.', 'lesson', 'beginner'),
    (3, 'Email Security Quiz', 'Test your knowledge of email security best practices.', 'quiz', 'beginner'),
    (4, 'Advanced Phishing Techniques', 'Learn about sophisticated phishing attacks including spear phishing, whaling, and business email compromise.', 'lesson', 'intermediate'),
    (5, 'Phishing Simulation - Fake Invoice', 'Practice identifying a fake invoice phishing attempt.', 'simulation', 'beginner')`);

  // Insert quiz questions
  db.run(`INSERT OR IGNORE INTO quiz_questions (module_id, question, options, correct_answer, explanation) VALUES 
    (3, 'What should you do if you receive an unexpected email asking for your password?', '["Enter your password immediately", "Ignore the email", "Verify through official channels first", "Forward it to colleagues"]', 2, 'Always verify requests for sensitive information through official channels before responding.'),
    (3, 'Which of these is a red flag in an email?', '["Professional formatting", "Urgent deadline pressure", "Correct spelling", "Official company logo"]', 1, 'Urgent pressure tactics are commonly used in phishing emails to make you act without thinking.'),
    (3, 'What is the safest way to access your bank account?', '["Click links in emails", "Type the URL directly", "Use saved bookmarks", "Both B and C"]', 3, 'Always access sensitive accounts by typing URLs directly or using saved bookmarks, never through email links.')`);

  // Insert phishing simulations
  db.run(`INSERT OR IGNORE INTO phishing_simulations (id, title, description, email_template, landing_page, difficulty, red_flags) VALUES 
    (1, 'Fake Invoice Phishing', 'A common phishing attempt disguised as an overdue invoice', 
    '<div style="font-family: Arial, sans-serif; max-width: 600px;"><h2 style="color: #d32f2f;">URGENT: Payment Required</h2><p>Dear Valued Customer,</p><p>Your invoice #INV-2024-7891 for $847.99 is now <strong>30 days overdue</strong>. Immediate payment is required to avoid service suspension.</p><p><strong>Account will be suspended in 24 hours if payment is not received!</strong></p><p><a href="#" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">PAY NOW - URGENT</a></p><p>For questions, contact billing@urgentpayments.net</p><p>Billing Department<br>Global Services Inc.</p></div>',
    '<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 30px; border: 1px solid #ddd;"><h2>Payment Portal</h2><div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; margin-bottom: 20px;"><strong>Session expires in 10 minutes!</strong></div><form><div style="margin-bottom: 15px;"><label>Email Address:</label><input type="email" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;" required></div><div style="margin-bottom: 15px;"><label>Password:</label><input type="password" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;" required></div><div style="margin-bottom: 15px;"><label>Credit Card Number:</label><input type="text" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;" required></div><button type="button" onclick="showResult()" style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Submit Payment</button></form></div>',
    'beginner', 
    '["Urgent/threatening language", "Suspicious sender email", "Generic greeting", "Immediate action required", "Unverified payment link"]')`);
});

// API Routes

// Get dashboard stats
app.get('/api/dashboard', (req, res) => {
  db.serialise(() => {
    let stats = {};
    
    db.get('SELECT COUNT(*) as total FROM users', (err, row) => {
      stats.totalUsers = row.total;
      
      db.get('SELECT COUNT(*) as total FROM training_modules', (err, row) => {
        stats.totalModules = row.total;
        
        db.get('SELECT COUNT(*) as total FROM user_progress WHERE completed = 1', (err, row) => {
          stats.completedLessons = row.total;
          
          db.get('SELECT COUNT(*) as total FROM simulation_results WHERE fell_for_phish = 0', (err, row) => {
            stats.successfulIdentifications = row.total;
            res.json(stats);
          });
        });
      });
    });
  });
});

// User Management
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', (req, res) => {
  const { email, name, department } = req.body;
  
  db.run('INSERT INTO users (email, name, department) VALUES (?, ?, ?)', 
    [email, name, department], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'User added successfully' });
  });
});

// Training Modules
app.get('/api/training-modules', (req, res) => {
  db.all('SELECT * FROM training_modules ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/training-modules/:id', (req, res) => {
  const moduleId = req.params.id;
  
  db.get('SELECT * FROM training_modules WHERE id = ?', [moduleId], (err, module) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!module) return res.status(404).json({ error: 'Module not found' });
    
    if (module.module_type === 'quiz') {
      db.all('SELECT * FROM quiz_questions WHERE module_id = ?', [moduleId], (err, questions) => {
        if (err) return res.status(500).json({ error: err.message });
        module.questions = questions.map(q => ({
          ...q,
          options: JSON.parse(q.options)
        }));
        res.json(module);
      });
    } else {
      res.json(module);
    }
  });
});

// Phishing Simulations
app.get('/api/simulations', (req, res) => {
  db.all('SELECT id, title, description, difficulty FROM phishing_simulations ORDER BY difficulty, title', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/simulations/:id', (req, res) => {
  const simId = req.params.id;
  
  db.get('SELECT * FROM phishing_simulations WHERE id = ?', [simId], (err, simulation) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!simulation) return res.status(404).json({ error: 'Simulation not found' });
    
    simulation.red_flags = JSON.parse(simulation.red_flags || '[]');
    res.json(simulation);
  });
});

// Start simulation
app.get('/simulation/:id', (req, res) => {
  const simId = req.params.id;
  
  db.get('SELECT * FROM phishing_simulations WHERE id = ?', [simId], (err, simulation) => {
    if (err || !simulation) {
      return res.status(404).send('Simulation not found');
    }
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Phishing Simulation - ${simulation.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; }
          .email-container { 
            background: white; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .email-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 1px solid #ddd;
            border-radius: 8px 8px 0 0;
          }
          .email-body { padding: 20px; }
          .controls {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .btn {
            padding: 10px 20px;
            margin: 5px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .btn-danger { background: #dc3545; color: white; }
          .btn-success { background: #28a745; color: white; }
          .btn-warning { background: #ffc107; color: black; }
          .red-flags {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            border-radius: 4px;
            padding: 15px;
            margin: 15px 0;
          }
          .hidden { display: none; }
          .result-good { background: #d4edda; color: #155724; padding: 20px; border-radius: 8px; margin-top: 20px; }
          .result-bad { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎯 Phishing Simulation: ${simulation.title}</h1>
          <p><strong>Instructions:</strong> Review the email below and decide if it's legitimate or a phishing attempt. Look for red flags!</p>
          
          <div class="email-container">
            <div class="email-header">
              <strong>From:</strong> billing@urgentpayments.net<br>
              <strong>Subject:</strong> URGENT: Payment Required - Account Suspension Warning
            </div>
            <div class="email-body">
              ${simulation.email_template}
            </div>
          </div>
          
          <div class="controls">
            <h3>What do you think?</h3>
            <button class="btn btn-success" onclick="handleChoice(true)">✅ This looks legitimate</button>
            <button class="btn btn-danger" onclick="handleChoice(false)">⚠️ This is a phishing attempt</button>
            
            <div class="red-flags">
              <h4>🚩 Can you identify the red flags? (Check all that apply)</h4>
              <div id="redFlagsList"></div>
              <button class="btn btn-warning" onclick="checkRedFlags()">Check My Answers</button>
            </div>
          </div>
          
          <div id="result" class="hidden"></div>
        </div>
        
        <script>
          const simulation = ${JSON.stringify(simulation)};
          const redFlags = ${JSON.stringify(JSON.parse(simulation.red_flags || '[]'))};
          const startTime = Date.now();
          
          // Generate red flag checkboxes
          document.getElementById('redFlagsList').innerHTML = redFlags.map((flag, index) => 
            '<label style="display: block; margin: 8px 0;"><input type="checkbox" value="' + index + '"> ' + flag + '</label>'
          ).join('');
          
          function handleChoice(isLegitimate) {
            const timeTaken = Math.floor((Date.now() - startTime) / 1000);
            const fellForPhish = isLegitimate;
            
            let resultHtml = '';
            if (fellForPhish) {
              resultHtml = '<div class="result-bad"><h3>⚠️ You fell for the phishing attempt!</h3><p>This was a simulated phishing email. Here''s what you should have noticed:</p><ul>' + 
                redFlags.map(flag => '<li>' + flag + '</li>').join('') + 
                '</ul><p><strong>Remember:</strong> Always verify suspicious emails through official channels before taking action.</p></div>';
            } else {
              resultHtml = '<div class="result-good"><h3>🎉 Great job! You correctly identified this as phishing!</h3><p>You successfully avoided falling for this phishing attempt. Here are the red flags you should have noticed:</p><ul>' + 
                redFlags.map(flag => '<li>' + flag + '</li>').join('') + 
                '</ul></div>';
            }
            
            document.getElementById('result').innerHTML = resultHtml;
            document.getElementById('result').classList.remove('hidden');
            
            // Log the result
            fetch('/api/simulation-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                simulation_id: simulation.id,
                fell_for_phish: fellForPhish,
                time_taken: timeTaken,
                identified_red_flags: []
              })
            });
          }
          
          function checkRedFlags() {
            const checkedFlags = Array.from(document.querySelectorAll('#redFlagsList input:checked'))
              .map(cb => cb.value);
            
            let score = checkedFlags.length;
            let feedback = '<h4>Red Flag Analysis:</h4><ul>';
            
            redFlags.forEach((flag, index) => {
              if (checkedFlags.includes(index.toString())) {
                feedback += '<li style="color: green;">✅ ' + flag + ' - Correctly identified!</li>';
              } else {
                feedback += '<li style="color: red;">❌ ' + flag + ' - You missed this one</li>';
              }
            });
            
            feedback += '</ul><p>You identified ' + checkedFlags.length + ' out of ' + redFlags.length + ' red flags.</p>';
            
            document.getElementById('result').innerHTML = '<div class="result-good">' + feedback + '</div>';
            document.getElementById('result').classList.remove('hidden');
          }
        </script>
      </body>
      </html>
    `);
  });
});

// Log simulation result
app.post('/api/simulation-result', (req, res) => {
  const { simulation_id, fell_for_phish, time_taken, identified_red_flags } = req.body;
  
  db.run(`INSERT INTO simulation_results 
          (simulation_id, fell_for_phish, time_taken, identified_red_flags) 
          VALUES (?, ?, ?, ?)`, 
    [simulation_id, fell_for_phish, time_taken, JSON.stringify(identified_red_flags)], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

// Get user progress
app.get('/api/progress/:userId', (req, res) => {
  const userId = req.params.userId;
  
  db.all(`
    SELECT tm.*, up.completed, up.score, up.completed_at
    FROM training_modules tm
    LEFT JOIN user_progress up ON tm.id = up.module_id AND up.user_id = ?
    ORDER BY tm.id
  `, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get simulation results
app.get('/api/simulation-results', (req, res) => {
  db.all(`
    SELECT sr.*, ps.title, ps.difficulty
    FROM simulation_results sr
    JOIN phishing_simulations ps ON sr.simulation_id = ps.id
    ORDER BY sr.completed_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Serve main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Training portal
app.get('/training', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'training.html'));
});

app.listen(PORT, () => {
  console.log(`PhishLab Educational Platform running on port ${PORT}`);
  console.log(`Access dashboard at: http://localhost:${PORT}`);
  console.log(`Access training portal at: http://localhost:${PORT}/training`);
});