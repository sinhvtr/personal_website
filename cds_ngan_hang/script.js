// Elements
const screens = {
    home: document.getElementById('home-screen'),
    practiceSettings: document.getElementById('practice-settings-screen'),
    quiz: document.getElementById('quiz-screen'),
    result: document.getElementById('result-screen')
};

const ui = {
    btnPractice: document.getElementById('btn-practice'),
    btnExam: document.getElementById('btn-exam'),
    loadingIndicator: document.getElementById('loading-indicator'),
    categorySelect: document.getElementById('category-select'),
    questionJump: document.getElementById('question-jump'),
    btnStartPractice: document.getElementById('btn-start-practice'),
    btnBackHome: document.querySelectorAll('.btn-back-home'),
    
    questionNumberDisplay: document.getElementById('question-number-display'),
    examProgress: document.getElementById('exam-progress'),
    timerText: document.getElementById('timer-text'),
    timerCircle: document.getElementById('timer-circle'),
    questionText: document.getElementById('question-text'),
    answersGrid: document.getElementById('answers-grid'),
    answerBtns: document.querySelectorAll('.answer-btn'),
    
    practiceControls: document.getElementById('practice-controls'),
    btnPrevQ: document.getElementById('btn-prev-q'),
    btnNextQ: document.getElementById('btn-next-q'),
    quickJumpInput: document.getElementById('quick-jump-input'),
    btnQuickJump: document.getElementById('btn-quick-jump'),
    btnShowAnswer: document.getElementById('btn-show-answer'),
    
    explanationBox: document.getElementById('explanation-box'),
    correctAnswerText: document.getElementById('correct-answer-text'),
    referenceText: document.getElementById('reference-text'),
    clauseText: document.getElementById('clause-text'),
    
    totalScore: document.getElementById('total-score'),
    countSuper: document.getElementById('count-super'),
    countMedium: document.getElementById('count-medium'),
    countSlow: document.getElementById('count-slow'),
    countWrong: document.getElementById('count-wrong'),
    detailedResults: document.getElementById('detailed-results'),
    btnRetryExam: document.getElementById('btn-retry-exam')
};

// State
let allQuestions = [];
let currentQuestions = [];
let currentQuestionIndex = 0;
let mode = ''; // 'practice' or 'exam'
let timerInterval;
let timeLeft = 15;
let currentSelection = null;
let currentSelectionTime = 0; // time taken to select
let examResults = [];
let isTimeUp = false;
let startTime = 0;

// CSV Parser
function parseCSV(text) {
    let result = [];
    let row = [];
    let inQuotes = false;
    let currentValue = "";
    
    // Remove BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }
    
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        let nextChar = text[i + 1];
        
        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                currentValue += '"';
                i++; // skip next
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentValue += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ';') {
                row.push(currentValue.trim());
                currentValue = "";
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && nextChar === '\n') {
                    i++; // skip \n
                }
                row.push(currentValue.trim());
                if (row.length > 1 || row[0] !== "") {
                    result.push(row);
                }
                row = [];
                currentValue = "";
            } else {
                currentValue += char;
            }
        }
    }
    if (currentValue !== "" || row.length > 0) {
        row.push(currentValue.trim());
        result.push(row);
    }
    return result;
}

// Load Data
async function loadQuestions() {
    ui.loadingIndicator.style.display = 'block';
    ui.btnPractice.disabled = true;
    ui.btnExam.disabled = true;
    
    try {
        const response = await fetch('questions_bank.csv');
        if (!response.ok) throw new Error('Cannot load CSV');
        
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        
        // Skip header
        const dataRows = rows.slice(1);
        
        allQuestions = dataRows.map((row, index) => {
            // Columns: 0:STT, 1:Mảng, 2:Mảng con, 3:Câu hỏi, 4:A, 5:B, 6:C, 7:D, 8:Đáp án, 9:Giải thích, 10:Điều khoản
            if (row.length < 9) return null;
            return {
                stt: row[0] || (index + 1).toString(),
                category: row[1],
                question: row[3],
                options: {
                    'A': row[4],
                    'B': row[5],
                    'C': row[6],
                    'D': row[7]
                },
                correct: (row[8] || '').trim().toUpperCase(),
                explanation: row[9] || '',
                clause: row[10] || ''
            };
        }).filter(q => q !== null && q.question);
        
        populateCategories();
        
        ui.loadingIndicator.style.display = 'none';
        ui.btnPractice.disabled = false;
        ui.btnExam.disabled = false;
        console.log(`Loaded ${allQuestions.length} questions.`);
    } catch (error) {
        console.error(error);
        ui.loadingIndicator.textContent = 'Lỗi tải dữ liệu. Hãy chạy trên Local Server.';
    }
}

function populateCategories() {
    const categories = [...new Set(allQuestions.map(q => q.category).filter(c => c))];
    ui.categorySelect.innerHTML = '<option value="all">-- Tất cả --</option>';
    categories.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        ui.categorySelect.appendChild(option);
    });
}

// Navigation
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Event Listeners
ui.btnPractice.addEventListener('click', () => switchScreen('practiceSettings'));
ui.btnExam.addEventListener('click', startExam);

ui.btnBackHome.forEach(btn => {
    btn.addEventListener('click', () => {
        clearInterval(timerInterval);
        switchScreen('home');
    });
});

ui.btnStartPractice.addEventListener('click', startPractice);
ui.btnPrevQ.addEventListener('click', () => goToQuestion(currentQuestionIndex - 1));
ui.btnNextQ.addEventListener('click', () => goToQuestion(currentQuestionIndex + 1));
ui.btnQuickJump.addEventListener('click', () => {
    const stt = ui.quickJumpInput.value;
    const index = currentQuestions.findIndex(q => q.stt === stt);
    if (index !== -1) goToQuestion(index);
    else alert('Không tìm thấy câu hỏi số ' + stt);
});

ui.btnShowAnswer.addEventListener('click', () => {
    if (mode === 'practice' && !isTimeUp) {
        clearInterval(timerInterval);
        handleTimeUp();
    }
});
ui.btnRetryExam.addEventListener('click', startExam);

ui.answerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (isTimeUp) return;
        
        // Visual selection
        ui.answerBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        // Record selection
        currentSelection = btn.dataset.answer;
        
        // Calculate time taken (in seconds, with decimals)
        const timeTaken = (Date.now() - startTime) / 1000;
        currentSelectionTime = timeTaken;
    });
});

// App Logic
function startPractice() {
    mode = 'practice';
    const selectedCategory = ui.categorySelect.value;
    const startStt = ui.questionJump.value;
    
    if (selectedCategory === 'all') {
        currentQuestions = [...allQuestions];
    } else {
        currentQuestions = allQuestions.filter(q => q.category === selectedCategory);
    }
    
    if (currentQuestions.length === 0) {
        alert('Không có câu hỏi nào trong danh mục này.');
        return;
    }
    
    currentQuestionIndex = 0;
    if (startStt) {
        const idx = currentQuestions.findIndex(q => q.stt === startStt);
        if (idx !== -1) currentQuestionIndex = idx;
    }
    
    ui.examProgress.style.display = 'none';
    ui.practiceControls.style.display = 'flex';
    
    switchScreen('quiz');
    loadQuestion(currentQuestionIndex);
}

function startExam() {
    mode = 'exam';
    examResults = [];
    
    // Pick 10 random questions
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    currentQuestions = shuffled.slice(0, 10);
    currentQuestionIndex = 0;
    
    ui.examProgress.style.display = 'block';
    ui.practiceControls.style.display = 'none';
    
    switchScreen('quiz');
    loadQuestion(currentQuestionIndex);
}

function loadQuestion(index) {
    if (index < 0 || index >= currentQuestions.length) return;
    
    const q = currentQuestions[index];
    
    ui.questionNumberDisplay.textContent = mode === 'practice' ? `CÂU ${q.stt} / ${allQuestions.length}` : `CÂU ${index + 1} / 10`;
    if (mode === 'exam') ui.examProgress.textContent = `Câu ${index + 1}/10`;
    
    ui.questionText.textContent = q.question;
    document.getElementById('answer-text-a').textContent = q.options['A'];
    document.getElementById('answer-text-b').textContent = q.options['B'];
    document.getElementById('answer-text-c').textContent = q.options['C'];
    document.getElementById('answer-text-d').textContent = q.options['D'];
    
    // Reset state
    ui.answerBtns.forEach(b => {
        b.classList.remove('selected', 'correct', 'wrong');
        b.disabled = false;
    });
    ui.explanationBox.style.display = 'none';
    ui.timerCircle.classList.remove('warning');
    
    currentSelection = null;
    currentSelectionTime = 0;
    isTimeUp = false;
    timeLeft = 15;
    ui.timerText.textContent = timeLeft;
    startTime = Date.now();
    
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    timeLeft--;
    ui.timerText.textContent = timeLeft;
    
    if (timeLeft <= 5 && timeLeft > 0) {
        ui.timerCircle.classList.add('warning');
    }
    
    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        handleTimeUp();
    }
}

function handleTimeUp() {
    isTimeUp = true;
    ui.timerText.textContent = "0";
    
    const q = currentQuestions[currentQuestionIndex];
    const correctAns = q.correct;
    
    // Highlight correct answer
    ui.answerBtns.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.answer === correctAns) {
            btn.classList.add('correct');
        } else if (btn.classList.contains('selected')) {
            btn.classList.add('wrong');
        }
    });
    
    if (mode === 'practice') {
        // Show explanation
        ui.correctAnswerText.textContent = correctAns + ' - ' + q.options[correctAns];
        ui.referenceText.textContent = q.explanation || 'Không có';
        ui.clauseText.textContent = q.clause || 'Không có';
        ui.explanationBox.style.display = 'block';
    } else if (mode === 'exam') {
        // Record result
        let points = 0;
        let speedClass = '';
        
        if (currentSelection === correctAns) {
            if (currentSelectionTime < 5) {
                points = 2;
                speedClass = 'super-fast';
            } else if (currentSelectionTime < 10) {
                points = 1.75;
                speedClass = 'medium';
            } else {
                points = 1.5;
                speedClass = 'slow';
            }
        } else {
            points = 0;
            speedClass = 'wrong';
        }
        
        examResults.push({
            questionNum: currentQuestionIndex + 1,
            qIndex: currentQuestionIndex,
            time: currentSelection ? currentSelectionTime.toFixed(1) : 15.0,
            points: points,
            speedClass: speedClass
        });
        
        // Next question after 2 seconds
        setTimeout(() => {
            if (currentQuestionIndex < 9) {
                currentQuestionIndex++;
                loadQuestion(currentQuestionIndex);
            } else {
                showExamResults();
            }
        }, 2000);
    }
}

function goToQuestion(index) {
    if (index >= 0 && index < currentQuestions.length) {
        currentQuestionIndex = index;
        loadQuestion(currentQuestionIndex);
    }
}

function showExamResults() {
    clearInterval(timerInterval);
    switchScreen('result');
    
    let total = 0;
    let countSuper = 0, countMedium = 0, countSlow = 0, countWrong = 0;
    
    ui.detailedResults.innerHTML = '';
    
    examResults.forEach(res => {
        total += res.points;
        
        if (res.speedClass === 'super-fast') countSuper++;
        else if (res.speedClass === 'medium') countMedium++;
        else if (res.speedClass === 'slow') countSlow++;
        else countWrong++;
        
        let pointsClass = 'zero';
        if (res.points === 2) pointsClass = 'full';
        else if (res.points === 1.75) pointsClass = 'medium';
        else if (res.points === 1.5) pointsClass = 'low';
        
        const row = document.createElement('div');
        row.className = 'result-row';
        row.innerHTML = `
            <div class="res-q">Câu ${res.questionNum}</div>
            <div class="res-action" style="flex:1; text-align:center;">
                ${res.speedClass === 'wrong' ? `<button class="btn ghost btn-small review-btn" style="padding: 2px 8px; font-size: 0.8rem;">Xem lại</button>` : ``}
            </div>
            <div class="res-time">${res.time}s</div>
            <div class="res-points ${pointsClass}">${res.points > 0 ? '+' : ''}${res.points} đ</div>
        `;
        ui.detailedResults.appendChild(row);

        if (res.speedClass === 'wrong') {
            const q = currentQuestions[res.qIndex];
            const correctAns = q.correct;
            
            const expDiv = document.createElement('div');
            expDiv.className = 'review-explanation';
            expDiv.style.display = 'none';
            expDiv.style.padding = '12px 16px';
            expDiv.style.background = 'rgba(0, 0, 0, 0.2)';
            expDiv.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
            expDiv.style.fontSize = '0.95rem';
            expDiv.style.color = 'var(--text-dim)';
            expDiv.style.lineHeight = '1.5';
            expDiv.innerHTML = `
                <div style="margin-bottom: 8px; color: white;"><strong>Hỏi:</strong> ${q.question}</div>
                <div style="margin-bottom: 4px;"><strong>Đáp án đúng:</strong> <span class="text-green">${correctAns} - ${q.options[correctAns]}</span></div>
                <div style="margin-bottom: 4px;"><strong>Tài liệu:</strong> ${q.explanation || 'Không có'}</div>
                <div><strong>Điều khoản:</strong> ${q.clause || 'Không có'}</div>
            `;
            ui.detailedResults.appendChild(expDiv);
            
            row.querySelector('.review-btn').addEventListener('click', () => {
                if (expDiv.style.display === 'none') {
                    expDiv.style.display = 'block';
                    row.querySelector('.review-btn').textContent = 'Đóng';
                } else {
                    expDiv.style.display = 'none';
                    row.querySelector('.review-btn').textContent = 'Xem lại';
                }
            });
        }
    });
    
    ui.totalScore.textContent = total;
    ui.countSuper.textContent = countSuper;
    ui.countMedium.textContent = countMedium;
    ui.countSlow.textContent = countSlow;
    ui.countWrong.textContent = countWrong;
}

// Init
window.addEventListener('DOMContentLoaded', loadQuestions);
