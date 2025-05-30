const express = require('express');
const router = express.Router();

// Get all training modules
router.get('/training-modules', (req, res) => {
  const db = req.app.locals.db;
  
  db.all('SELECT * FROM training_modules ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Get specific training module
router.get('/training-modules/:id', (req, res) => {
  const db = req.app.locals.db;
  const moduleId = req.params.id;
  
  db.get('SELECT * FROM training_modules WHERE id = ?', [moduleId], (err, module) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!module) return res.status(404).json({ error: 'Module not found' });
    
    if (module.module_type === 'quiz') {
      db.all('SELECT * FROM quiz_questions WHERE module_id = ?', [moduleId], (err, questions) => {
        if (err) return res.status(500).json({ error: err.message });
        module.questions = (questions || []).map(q => ({
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

module.exports = router;