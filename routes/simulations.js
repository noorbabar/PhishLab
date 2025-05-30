const express = require('express');
const router = express.Router();

// Get all simulations (for listing)
router.get('/simulations', (req, res) => {
  const db = req.app.locals.db;
  
  db.all('SELECT id, title, description, difficulty FROM phishing_simulations ORDER BY difficulty, title', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.get('/simulation-results', (req, res) => {
  const db = req.app.locals.db;
  
  const query = `
    SELECT sr.*, ps.title, ps.difficulty 
    FROM simulation_results sr 
    JOIN phishing_simulations ps ON sr.simulation_id = ps.id 
    ORDER BY sr.completed_at DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.post('/simulation-result', (req, res) => {
  const db = req.app.locals.db;
  const { simulation_id, fell_for_phish, time_taken, identified_red_flags } = req.body;
  
  // this isnt what ill actually use
  // but for now use user_id = 1 (default user)
  const user_id = 1;
  
  db.run(
    'INSERT INTO simulation_results (user_id, simulation_id, fell_for_phish, identified_red_flags, time_taken) VALUES (?, ?, ?, ?, ?)',
    [user_id, simulation_id, fell_for_phish ? 1 : 0, JSON.stringify(identified_red_flags || []), time_taken],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Result recorded successfully' });
    }
  );
});

module.exports = router;