const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database/init');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const trainingRoutes = require('./routes/training');
const simulationRoutes = require('./routes/simulations');

const app = express();
const PORT = process.env.PORT || 3001;

const db = initializeDatabase();
app.locals.db = db;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.use('/api', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api', trainingRoutes);
app.use('/api', simulationRoutes);

// Simulation page route (FIXED)
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5; 
            line-height: 1.6;
          }
          .container { 
            max-width: 800px; 
            margin: 0 auto; 
          }
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
            font-size: 14px;
          }
          .email-body { 
            padding: 20px; 
          }
          .controls {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .btn {
            padding: 12px 24px;
            margin: 8px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
          }
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
          .btn-danger { 
            background: #dc3545; 
            color: white; 
          }
          .btn-danger:hover { 
            background: #c82333; 
          }
          .btn-success { 
            background: #28a745; 
            color: white; 
          }
          .btn-success:hover { 
            background: #218838; 
          }
          .btn-warning { 
            background: #ffc107; 
            color: black; 
          }
          .btn-warning:hover { 
            background: #e0a800; 
          }
          .red-flags {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            border-radius: 4px;
            padding: 15px;
            margin: 15px 0;
          }
          .red-flags h4 {
            margin-bottom: 15px;
            color: #856404;
          }
          .flag-option {
            display: block;
            margin: 10px 0;
            cursor: pointer;
            padding: 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
          }
          .flag-option:hover {
            background: #f8f9fa;
          }
          .flag-option input {
            margin-right: 10px;
            transform: scale(1.2);
          }
          .hidden { 
            display: none !important; 
          }
          .result-good { 
            background: #d4edda; 
            color: #155724; 
            padding: 20px; 
            border-radius: 8px; 
            margin-top: 20px;
            border: 1px solid #c3e6cb;
          }
          .result-bad { 
            background: #f8d7da; 
            color: #721c24; 
            padding: 20px; 
            border-radius: 8px; 
            margin-top: 20px;
            border: 1px solid #f5c6cb;
          }
          .result-good h3, .result-bad h3 {
            margin-bottom: 15px;
          }
          .result-good ul, .result-bad ul {
            margin: 15px 0;
            padding-left: 20px;
          }
          .result-good li, .result-bad li {
            margin: 8px 0;
          }
          .back-link {
            display: inline-block;
            margin-top: 20px;
            color: #667eea;
            text-decoration: none;
            font-weight: bold;
          }
          .back-link:hover {
            text-decoration: underline;
          }
          .timer {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 10px 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            font-weight: bold;
            z-index: 1000;
          }
          @media (max-width: 768px) {
            .container {
              padding: 10px;
            }
            .btn {
              display: block;
              width: 100%;
              margin: 10px 0;
            }
            .timer {
              position: static;
              margin-bottom: 20px;
              text-align: center;
            }
          }
        </style>
      </head>
      <body>
        <div class="timer" id="timer">Time: 0s</div>
        
        <div class="container">
          <h1>🎯 Phishing Simulation: ${simulation.title}</h1>
          <p><strong>Instructions:</strong> Review the email below and decide if it's legitimate or a phishing attempt. Look for red flags!</p>
          
          <div class="email-container">
            <div class="email-header">
              <strong>From:</strong> billing@urgentpayments.net<br>
              <strong>To:</strong> you@yourcompany.com<br>
              <strong>Subject:</strong> URGENT: Payment Required - Account Suspension Warning<br>
              <strong>Date:</strong> ${new Date().toLocaleDateString()}
            </div>
            <div class="email-body">
              ${simulation.email_template}
            </div>
          </div>
          
          <div class="controls" id="mainControls">
            <h3>🤔 What do you think about this email?</h3>
            <p>Take your time to analyze the email above, then make your choice:</p>
            
            <button class="btn btn-success" onclick="handleChoice(true)">
              ✅ This looks legitimate - I would trust it
            </button>
            <button class="btn btn-danger" onclick="handleChoice(false)">
              ⚠️ This is a phishing attempt - Something seems suspicious
            </button>
            
            <div class="red-flags">
              <h4>🚩 Before you decide, can you identify potential red flags?</h4>
              <p><em>Check all that apply (this will help with your learning):</em></p>
              <div id="redFlagsList"></div>
              <button class="btn btn-warning" onclick="showRedFlagAnalysis()">
                🔍 Analyze Red Flags
              </button>
            </div>
          </div>
          
          <div id="result" class="hidden"></div>
          
          <a href="/" class="back-link">← Back to Dashboard</a>
        </div>
        
        <script>
          console.log('Script loaded');
          
          const simulation = ${JSON.stringify(simulation)};
          const redFlags = ${JSON.stringify(JSON.parse(simulation.red_flags || '[]'))};
          const startTime = Date.now();
          let hasAnswered = false;
          let timerInterval;
          
          console.log('Simulation data:', simulation);
          console.log('Red flags:', redFlags);
          
          // Update timer every second
          function startTimer() {
            timerInterval = setInterval(() => {
              const elapsed = Math.floor((Date.now() - startTime) / 1000);
              const timerElement = document.getElementById('timer');
              if (timerElement) {
                timerElement.textContent = 'Time: ' + elapsed + 's';
              }
            }, 1000);
          }
          
          // Generate red flag checkboxes
          function initializeRedFlags() {
            const flagsList = document.getElementById('redFlagsList');
            if (flagsList && redFlags && redFlags.length > 0) {
              flagsList.innerHTML = redFlags.map((flag, index) => 
                '<label class="flag-option"><input type="checkbox" value="' + index + '"> ' + flag + '</label>'
              ).join('');
            }
          }
          
          function handleChoice(isLegitimate) {
            console.log('Choice made:', isLegitimate);
            
            if (hasAnswered) {
              console.log('Already answered');
              return;
            }
            
            hasAnswered = true;
            
            if (timerInterval) {
              clearInterval(timerInterval);
            }
            
            const timeTaken = Math.floor((Date.now() - startTime) / 1000);
            const fellForPhish = isLegitimate;
            
            console.log('Time taken:', timeTaken, 'Fell for phish:', fellForPhish);
            
            // Hide main controls
            const mainControls = document.getElementById('mainControls');
            if (mainControls) {
              mainControls.classList.add('hidden');
            }
            
            let resultHtml = '';
            if (fellForPhish) {
              resultHtml = '<div class="result-bad">' +
                '<h3>⚠️ You fell for the phishing attempt!</h3>' +
                '<p><strong>Don\\'t worry - this was just a simulation!</strong> This was designed to test your phishing detection skills.</p>' +
                '<p>Here are the red flags you should have noticed:</p>' +
                '<ul>' + redFlags.map(flag => '<li>' + flag + '</li>').join('') + '</ul>' +
                '<p><strong>Key Learning:</strong> Always verify suspicious emails through official channels before taking any action. When in doubt, contact the organization directly using a phone number or website you know is legitimate.</p>' +
                '<p><strong>Time taken:</strong> ' + timeTaken + ' seconds</p>' +
                '</div>';
            } else {
              resultHtml = '<div class="result-good">' +
                '<h3>🎉 Excellent! You correctly identified this as phishing!</h3>' +
                '<p>You successfully avoided falling for this phishing attempt. Your security awareness is working!</p>' +
                '<p>Here are the red flags that helped you identify this as suspicious:</p>' +
                '<ul>' + redFlags.map(flag => '<li>' + flag + '</li>').join('') + '</ul>' +
                '<p><strong>Keep it up!</strong> Continue to be vigilant about suspicious emails and always verify before you trust.</p>' +
                '<p><strong>Time taken:</strong> ' + timeTaken + ' seconds</p>' +
                '</div>';
            }
            
            const resultDiv = document.getElementById('result');
            if (resultDiv) {
              resultDiv.innerHTML = resultHtml;
              resultDiv.classList.remove('hidden');
              
              // Scroll to results
              resultDiv.scrollIntoView({ behavior: 'smooth' });
            }
            
            // Log the result to the server
            fetch('/api/simulation-result', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                simulation_id: simulation.id,
                fell_for_phish: fellForPhish,
                time_taken: timeTaken,
                identified_red_flags: getSelectedRedFlags()
              })
            }).then(response => {
              console.log('Result logged:', response.ok);
            }).catch(err => {
              console.log('Error logging result:', err);
            });
          }
          
          function showRedFlagAnalysis() {
            console.log('Showing red flag analysis');
            
            const checkedFlags = getSelectedRedFlags();
            console.log('Checked flags:', checkedFlags);
            
            let feedback = '<div class="result-good">' +
              '<h4>🚩 Red Flag Analysis:</h4>' +
              '<p>Here\\'s how you did at identifying red flags:</p>' +
              '<ul>';
            
            redFlags.forEach((flag, index) => {
              if (checkedFlags.includes(index)) {
                feedback += '<li style="color: #28a745; font-weight: bold;">✅ ' + flag + ' - You identified this correctly!</li>';
              } else {
                feedback += '<li style="color: #dc3545;">❌ ' + flag + ' - You missed this red flag</li>';
              }
            });
            
            feedback += '</ul>' +
              '<p><strong>Score:</strong> You identified ' + checkedFlags.length + ' out of ' + redFlags.length + ' red flags.</p>' +
              '<p><em>Now make your decision about whether this email is legitimate or phishing.</em></p>' +
              '</div>';
            
            const resultDiv = document.getElementById('result');
            if (resultDiv) {
              resultDiv.innerHTML = feedback;
              resultDiv.classList.remove('hidden');
              resultDiv.scrollIntoView({ behavior: 'smooth' });
            }
          }
          
          function getSelectedRedFlags() {
            const checkboxes = document.querySelectorAll('#redFlagsList input:checked');
            return Array.from(checkboxes).map(cb => parseInt(cb.value));
          }
          
          // Initialize when DOM is loaded
          document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded, initializing...');
            startTimer();
            initializeRedFlags();
          });
          
          // Also initialize immediately in case DOM is already loaded
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              console.log('DOM loaded (delayed), initializing...');
              startTimer();
              initializeRedFlags();
            });
          } else {
            console.log('DOM already loaded, initializing immediately...');
            startTimer();
            initializeRedFlags();
          }
        </script>
      </body>
      </html>
    `);
  });
});

app.listen(PORT, () => {
  console.log(`PhishLab server running on port ${PORT}`);
});

module.exports = app;
