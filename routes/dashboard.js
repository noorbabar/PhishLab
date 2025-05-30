const express = require('express');
const router = express.Router();

// Get dashboard stats
router.get('/dashboard', (req, res) => {
  const db = req.app.locals.db;
  
  db.serialize(() => {
    let stats = {};
    
    db.get('SELECT COUNT(*) as total FROM users', (err, row) => {
      stats.totalUsers = row ? row.total : 0;
      
      db.get('SELECT COUNT(*) as total FROM training_modules', (err, row) => {
        stats.totalModules = row ? row.total : 0;
        
        db.get('SELECT COUNT(*) as total FROM user_progress WHERE completed = 1', (err, row) => {
          stats.completedLessons = row ? row.total : 0;
          
          db.get('SELECT COUNT(*) as total FROM simulation_results WHERE fell_for_phish = 0', (err, row) => {
            stats.successfulIdentifications = row ? row.total : 0;
            res.json(stats);
          });
        });
      });
    });
  });
});

module.exports = router;