// Global variables
let uploadedFiles = [];
let currentCombinations = [];

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadedImages = document.getElementById('uploadedImages');
const generateBtn = document.getElementById('generateBtn');
const resultsSection = document.getElementById('resultsSection');
const combinationsContainer = document.getElementById('combinationsContainer');
const occasion = document.getElementById('occasion');
const clothingType = document.getElementById('clothingType');
const colorPreference = document.getElementById('colorPreference');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateGenerateButton();
});

// Setup all event listeners
function setupEventListeners() {
    // Upload area click
    uploadArea.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // Generate button click
    generateBtn.addEventListener('click', generateCombinations);

    // Form change events
    occasion.addEventListener('change', updateGenerateButton);
    clothingType.addEventListener('change', updateGenerateButton);
}

// Handle file selection
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    processFiles(files);
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

// Handle drop
function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
        processFiles(imageFiles);
    } else {
        showError('Please drop only image files.');
    }
}

// Process uploaded files
function processFiles(files) {
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();

            reader.onload = function(e) {
                const fileData = {
                    file: file,
                    url: e.target.result,
                    name: file.name,
                    id: Date.now() + Math.random()
                };

                uploadedFiles.push(fileData);
                displayUploadedImage(fileData);
                updateGenerateButton();
            };

            reader.readAsDataURL(file);
        }
    });

    // Clear file input
    fileInput.value = '';
}

// Display uploaded image
function displayUploadedImage(fileData) {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.innerHTML = `
        <img src="${fileData.url}" alt="${fileData.name}">
        <button class="remove-btn" onclick="removeImage(${fileData.id})">×</button>
    `;

    uploadedImages.appendChild(imageItem);
}

// Remove image
function removeImage(id) {
    uploadedFiles = uploadedFiles.filter(file => file.id !== id);
    renderUploadedImages();
    updateGenerateButton();
}

// Re-render all uploaded images
function renderUploadedImages() {
    uploadedImages.innerHTML = '';
    uploadedFiles.forEach(fileData => {
        displayUploadedImage(fileData);
    });
}

// Update generate button state
function updateGenerateButton() {
    const hasImages = uploadedFiles.length > 0;
    const hasOccasion = occasion.value !== '';

    generateBtn.disabled = !(hasImages && hasOccasion);
}

// Generate combinations (main AI function)
function generateCombinations() {
    if (uploadedFiles.length === 0) {
        showError('Please upload at least one clothing item.');
        return;
    }

    if (!occasion.value) {
        showError('Please select an occasion.');
        return;
    }

    // Show loading state
    generateBtn.classList.add('loading');
    generateBtn.disabled = true;

    // Simulate AI processing (replace with actual API call)
    setTimeout(() => {
        const combinations = generateMockCombinations();
        displayCombinations(combinations);

        // Hide loading state
        generateBtn.classList.remove('loading');
        generateBtn.disabled = false;
        updateGenerateButton();

        // Show results section
        resultsSection.classList.add('show');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }, 2000);
}

// Generate mock combinations (replace with actual AI logic)
function generateMockCombinations() {
    const combinations = [];
    const occasionValue = occasion.value;
    const clothingTypeValue = clothingType.value;
    const colorPreferenceValue = colorPreference.value;

    // Create different combination scenarios
    const scenarios = [
        {
            title: `Perfect ${occasionValue} Look`,
            description: `Ideal combination for ${occasionValue} occasions with great color harmony`,
            rating: 5,
            confidence: 95
        },
        {
            title: `Classic ${occasionValue} Style`,
            description: `Timeless combination that works well for ${occasionValue} events`,
            rating: 4,
            confidence: 88
        },
        {
            title: `Modern ${occasionValue} Outfit`,
            description: `Contemporary styling perfect for ${occasionValue} settings`,
            rating: 4,
            confidence: 82
        }
    ];

    // Generate combinations based on uploaded images
    scenarios.forEach((scenario, index) => {
        if (index < Math.min(uploadedFiles.length, 3)) {
            const combination = {
                id: index + 1,
                title: scenario.title,
                description: scenario.description,
                rating: scenario.rating,
                confidence: scenario.confidence,
                images: getRandomImages(2, 4), // Select 2-4 random images
                colorAnalysis: analyzeColors(),
                styleNotes: generateStyleNotes(occasionValue, clothingTypeValue, colorPreferenceValue)
            };

            combinations.push(combination);
        }
    });

    return combinations;
}

// Get random images from uploaded files
function getRandomImages(min, max) {
    const count = Math.min(
        Math.max(min, Math.floor(Math.random() * (max - min + 1)) + min),
        uploadedFiles.length
    );

    const shuffled = [...uploadedFiles].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Analyze colors (mock analysis)
function analyzeColors() {
    const colorAnalysis = [
        'Complementary color scheme detected',
        'Harmonious color palette',
        'Bold color contrast',
        'Monochromatic styling',
        'Neutral base with accent colors'
    ];

    return colorAnalysis[Math.floor(Math.random() * colorAnalysis.length)];
}

// Generate style notes
function generateStyleNotes(occasion, clothingType, colorPref) {
    const notes = [];

    if (occasion === 'formal') {
        notes.push('Sophisticated and elegant pairing');
    } else if (occasion === 'casual') {
        notes.push('Relaxed and comfortable combination');
    } else if (occasion === 'party') {
        notes.push('Eye-catching and trendy styling');
    }

    if (clothingType) {
        notes.push(`Focused on ${clothingType} as the main piece`);
    }

    if (colorPref) {
        notes.push(`Emphasizing ${colorPref} color scheme`);
    }

    return notes.join(' • ');
}

// Display combinations
function displayCombinations(combinations) {
    combinationsContainer.innerHTML = '';

    combinations.forEach(combination => {
        const card = document.createElement('div');
        card.className = 'combination-card';

        const starsHtml = '★'.repeat(combination.rating) + '☆'.repeat(5 - combination.rating);

        const imagesHtml = combination.images.map(img => 
            `<img src="${img.url}" alt="${img.name}" class="combo-image">`
        ).join('');

        card.innerHTML = `
            <div class="combination-rating">
                <span class="stars">${starsHtml}</span>
                <span class="confidence">(${combination.confidence}% match)</span>
            </div>

            <div class="combination-images">
                ${imagesHtml}
            </div>

            <div class="combination-title">${combination.title}</div>
            <div class="combination-description">${combination.description}</div>

            <div class="combination-details">
                <p><strong>Color Analysis:</strong> ${combination.colorAnalysis}</p>
                <p><strong>Style Notes:</strong> ${combination.styleNotes}</p>
            </div>
        `;

        combinationsContainer.appendChild(card);
    });

    currentCombinations = combinations;
}

// Utility functions
function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}

function showMessage(message, type) {
    // Remove existing messages
    document.querySelectorAll('.success-message, .error-message').forEach(el => el.remove());

    const messageEl = document.createElement('div');
    messageEl.className = `${type}-message show`;
    messageEl.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(messageEl, container.firstChild);

    // Auto hide after 5 seconds
    setTimeout(() => {
        messageEl.classList.remove('show');
        setTimeout(() => messageEl.remove(), 300);
    }, 5000);
}

// Color analysis helper (for future AI integration)
function extractDominantColors(imageElement) {
    // This would use canvas to analyze image colors
    // Placeholder for actual implementation
    return ['#FF5733', '#33FF57', '#3357FF'];
}

// Pattern detection helper (for future AI integration)
function detectPatterns(imageElement) {
    // This would use computer vision to detect patterns
    // Placeholder for actual implementation
    return ['solid', 'striped', 'checkered', 'floral', 'geometric'][Math.floor(Math.random() * 5)];
}

// Export functions for potential API integration
window.clothingApp = {
    uploadedFiles,
    generateCombinations,
    extractDominantColors,
    detectPatterns,
    currentCombinations
};

// Add some enhanced styling for the combination cards
const additionalCSS = `
.combination-details {
    text-align: left;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #e0e0e0;
    font-size: 0.9rem;
}

.combination-details p {
    margin-bottom: 8px;
    line-height: 1.4;
}

.combination-details strong {
    color: #667eea;
}

.confidence {
    font-size: 0.9rem;
    color: #666;
    margin-left: 10px;
}

.stars {
    color: #ffd700;
}
`;

// Inject additional CSS
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);