const express = require('express');
const router = express.Router();

// Get all users
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  
  db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Add new user
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { email, name, department } = req.body;
  
  if (!email || !name) {
    return res.status(400).json({ error: 'Email and name are required' });
  }
  
  db.run('INSERT INTO users (email, name, department) VALUES (?, ?, ?)', 
    [email, name, department], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, message: 'User added successfully' });
  });
});

module.exports = router;