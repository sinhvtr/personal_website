// Chart.js Global Config
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } }
    }
};

// --- Scrollytelling Logic (index.html) ---
let scrollyChartInstance = null;

const scrollyData = {
    1: [20, 5, 0], // 2010
    2: [85, 30, 10], // 2015
    3: [99, 95, 80], // 2024
    4: [99, 95, 80] // keep data
};

document.addEventListener('DOMContentLoaded', () => {
    
    // Initialize Scrolly Chart
    const scrollyCtx = document.getElementById('scrollyChart');
    if (scrollyCtx) {
        scrollyChartInstance = new Chart(scrollyCtx, {
            type: 'bar',
            data: {
                labels: ['Nhận diện hình ảnh', 'Đọc hiểu văn bản', 'Suy luận Logic'],
                datasets: [{
                    label: 'Điểm chuẩn AI (%)',
                    data: scrollyData[1],
                    backgroundColor: [
                        'rgba(0, 240, 255, 0.8)',
                        'rgba(138, 43, 226, 0.8)',
                        'rgba(255, 0, 85, 0.8)'
                    ],
                    borderRadius: 5
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { max: 100, beginAtZero: true }
                },
                animation: { duration: 1000, easing: 'easeOutQuart' }
            }
        });

        // Intersection Observer for Scrollytelling
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Update active class
                    document.querySelectorAll('.step-block').forEach(b => b.classList.remove('is-active'));
                    entry.target.classList.add('is-active');

                    // Update chart data based on step
                    const step = entry.target.getAttribute('data-step');
                    if (step && scrollyData[step]) {
                        scrollyChartInstance.data.datasets[0].data = scrollyData[step];
                        scrollyChartInstance.update();
                    }
                }
            });
        }, { threshold: 0.5 });

        document.querySelectorAll('.step-block').forEach(block => observer.observe(block));

        // CTA Slider Logic
        const slider = document.getElementById('routine-slider');
        const ctaMsg = document.getElementById('cta-message');
        if (slider && ctaMsg) {
            slider.addEventListener('input', (e) => {
                const val = e.target.value;
                document.getElementById('routine-val').innerText = val + '%';
                if (val > 60) {
                    ctaMsg.style.background = 'rgba(255,0,0,0.1)';
                    ctaMsg.style.borderLeftColor = '#ff0055';
                    ctaMsg.innerHTML = '<strong>Nguy cơ cực cao!</strong> Công việc của bạn có thể bị tự động hóa trong vòng 1-2 năm tới.';
                } else if (val > 30) {
                    ctaMsg.style.background = 'rgba(255,255,0,0.1)';
                    ctaMsg.style.borderLeftColor = '#ffff00';
                    ctaMsg.innerHTML = '<strong>Nguy cơ trung bình!</strong> Bạn cần bắt đầu sử dụng AI như một công cụ hỗ trợ ngay hôm nay.';
                } else {
                    ctaMsg.style.background = 'rgba(0,255,0,0.1)';
                    ctaMsg.style.borderLeftColor = '#00ff00';
                    ctaMsg.innerHTML = '<strong>An toàn!</strong> Công việc sáng tạo của bạn khó bị thay thế, nhưng AI sẽ giúp bạn tăng hiệu suất x10.';
                }
            });
        }
    }

    // Initialize Visualization Page Charts (if present)
    initVizCharts();
});

// --- Predictive App Logic (science.html) ---
let importanceChartInstance = null;

function runPrediction() {
    const industry = document.getElementById('industry').value;
    const exp = parseInt(document.getElementById('experience').value);
    const repetitive = parseInt(document.getElementById('repetitive').value);

    // Show loading
    document.getElementById('prediction-result').style.display = 'none';
    document.getElementById('loading').style.display = 'block';

    setTimeout(() => {
        // Dummy Logistic Regression Simulation
        let baseRisk = 0;
        if(industry === 'admin') baseRisk = 50;
        if(industry === 'tech') baseRisk = 30;
        if(industry === 'healthcare') baseRisk = 20;
        if(industry === 'creative') baseRisk = 10;

        // Experience reduces risk slightly (0.5% per year)
        let expFactor = exp * 0.5;
        
        // Repetitive tasks increase risk significantly
        let repFactor = repetitive * 0.4;

        let totalProb = baseRisk - expFactor + repFactor;
        if (totalProb < 0) totalProb = 2;
        if (totalProb > 99) totalProb = 99;

        totalProb = Math.round(totalProb);

        // Update UI
        document.getElementById('loading').style.display = 'none';
        document.getElementById('prediction-result').style.display = 'block';
        
        // Animate numbers
        let currentProb = 0;
        const probEl = document.getElementById('prob-value');
        const interval = setInterval(() => {
            currentProb += 2;
            if (currentProb >= totalProb) {
                currentProb = totalProb;
                clearInterval(interval);
            }
            probEl.innerText = currentProb + '%';
        }, 20);

        // Animate bar
        setTimeout(() => {
            document.getElementById('prob-bar').style.width = totalProb + '%';
        }, 100);

        // Update Feature Importance Chart
        updateImportanceChart([45, 15, 40]); // Industry, Experience, Repetitive

    }, 1500); // Simulate processing time
}

function updateImportanceChart(data) {
    const ctx = document.getElementById('importanceChart');
    if (!ctx) return;

    if (importanceChartInstance) {
        importanceChartInstance.destroy();
    }

    importanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tính chất lặp lại', 'Ngành nghề', 'Số năm kinh nghiệm'],
            datasets: [{
                label: 'Trọng số Ảnh hưởng (%)',
                data: [data[2], data[0], data[1]],
                backgroundColor: [
                    'rgba(255, 0, 85, 0.8)',
                    'rgba(138, 43, 226, 0.8)',
                    'rgba(0, 240, 255, 0.8)'
                ],
                indexAxis: 'y' // Horizontal bar chart
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { max: 100, beginAtZero: true }
            }
        }
    });
}

// --- Visualization & Analysis Pages ---
function initVizCharts() {
    const llmCtx = document.getElementById('llmChart');
    if (llmCtx) {
        new Chart(llmCtx, {
            type: 'bar',
            data: {
                labels: ['GPT-1 (2018)', 'GPT-2 (2019)', 'GPT-3 (2020)', 'PaLM (2022)', 'GPT-4 (2023)'],
                datasets: [{
                    label: 'Tham số (Tỷ)',
                    data: [0.117, 1.5, 175, 540, 1760],
                    backgroundColor: ['rgba(0, 240, 255, 0.2)', 'rgba(0, 240, 255, 0.4)', 'rgba(0, 240, 255, 0.6)', 'rgba(138, 43, 226, 0.6)', 'rgba(138, 43, 226, 0.9)'],
                    borderColor: '#00f0ff', borderWidth: 1
                }]
            },
            options: { ...commonOptions, scales: { y: { type: 'logarithmic' } } }
        });
    }

    const investCtx = document.getElementById('investmentChart');
    if (investCtx) {
        new Chart(investCtx, {
            type: 'line',
            data: {
                labels: ['2015', '2017', '2019', '2021', '2023'],
                datasets: [{ label: 'Vốn đầu tư', data: [15, 30, 45, 120, 250], borderColor: '#00f0ff', tension: 0.3 }]
            },
            options: commonOptions
        });
    }

    const paperCtx = document.getElementById('paperChart');
    if (paperCtx) {
        new Chart(paperCtx, {
            type: 'bar',
            data: {
                labels: ['2010', '2015', '2020', '2023'],
                datasets: [{ label: 'Nghiên cứu', data: [12000, 35000, 105000, 210000], backgroundColor: 'rgba(138, 43, 226, 0.5)', borderColor: '#8a2be2', borderWidth: 1 }]
            },
            options: commonOptions
        });
    }
}
