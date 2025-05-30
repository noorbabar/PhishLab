const sqlite3 = require('sqlite3').verbose();

function initializeDatabase() {
  const db = new sqlite3.Database('./phishbox.db');

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
      module_type TEXT NOT NULL,
      difficulty TEXT DEFAULT 'beginner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Quiz questions table
    db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer INTEGER NOT NULL,
      explanation TEXT,
      FOREIGN KEY (module_id) REFERENCES training_modules (id)
    )`);

    // Phishing simulations table
    db.run(`CREATE TABLE IF NOT EXISTS phishing_simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      email_template TEXT NOT NULL,
      landing_page TEXT NOT NULL,
      difficulty TEXT DEFAULT 'beginner',
      red_flags TEXT,
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
      identified_red_flags TEXT,
      time_taken INTEGER,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (simulation_id) REFERENCES phishing_simulations (id)
    )`);

    // Insert default data
    insertDefaultData(db);
  });

  return db;
}

function insertDefaultData(db) {
  // Insert default user
  db.run(`INSERT OR IGNORE INTO users (id, email, name, department) VALUES 
    (1, 'demo@company.com', 'Demo User', 'IT')`);

  // Insert default training modules
  db.run(`INSERT OR IGNORE INTO training_modules (id, title, content, module_type, difficulty) VALUES 
    (1, 'Introduction to Phishing', 'Learn what phishing is and why it is dangerous. Phishing is a cyber attack where criminals impersonate legitimate organizations to steal sensitive information like passwords, credit card numbers, and personal data.', 'lesson', 'beginner'),
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
}

module.exports = { initializeDatabase };