// AI Style Matcher Application JavaScript

class AIStyleMatcher {
    constructor() {
        this.uploadedImages = [];
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.updateGenerateButtonState();
            });
        } else {
            this.setupEventListeners();
            this.updateGenerateButtonState();
        }
    }

    setupEventListeners() {
        // Upload area events
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
            
            uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
            uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
            uploadArea.addEventListener('drop', this.handleDrop.bind(this));

            // File input change
            fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        }

        // Form submission
        const form = document.getElementById('preferencesForm');
        if (form) {
            form.addEventListener('submit', this.handleFormSubmit.bind(this));
        }

        // Form field changes to update button state
        const formFields = ['occasion', 'clothingType', 'colorPreference'];
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('change', this.updateGenerateButtonState.bind(this));
                field.addEventListener('input', this.updateGenerateButtonState.bind(this));
            }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.classList.remove('drag-over');
        }
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
        // Reset the input so the same file can be selected again
        e.target.value = '';
    }

    processFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        imageFiles.forEach(file => {
            if (this.uploadedImages.length < 12) { // Limit to 12 images
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = {
                        id: Date.now() + Math.random(),
                        name: file.name,
                        src: e.target.result,
                        file: file
                    };
                    this.uploadedImages.push(imageData);
                    this.renderImagePreviews();
                    this.updateGenerateButtonState();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    renderImagePreviews() {
        const container = document.getElementById('imagePreviews');
        if (!container) return;
        
        container.innerHTML = '';

        this.uploadedImages.forEach(image => {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview';
            
            previewDiv.innerHTML = `
                <img src="${image.src}" alt="${image.name}" />
                <button class="image-remove" data-image-id="${image.id}" title="Remove image">
                    ✕
                </button>
            `;
            
            // Add click event to remove button
            const removeBtn = previewDiv.querySelector('.image-remove');
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.removeImage(image.id);
            });
            
            container.appendChild(previewDiv);
        });
    }

    removeImage(imageId) {
        this.uploadedImages = this.uploadedImages.filter(img => img.id != imageId);
        this.renderImagePreviews();
        this.updateGenerateButtonState();
    }

    updateGenerateButtonState() {
        const generateBtn = document.getElementById('generateBtn');
        const occasionField = document.getElementById('occasion');
        
        if (!generateBtn || !occasionField) return;
        
        const occasion = occasionField.value;
        const hasImages = this.uploadedImages.length > 0;

        generateBtn.disabled = !(hasImages && occasion);
        
        // Update button text based on state
        if (!hasImages) {
            generateBtn.textContent = 'Upload images first';
        } else if (!occasion) {
            generateBtn.textContent = 'Select occasion';
        } else {
            generateBtn.textContent = 'Generate Combinations';
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (this.uploadedImages.length === 0) {
            alert('Please upload at least one clothing item.');
            return;
        }

        const occasion = document.getElementById('occasion')?.value;
        if (!occasion) {
            alert('Please select an occasion.');
            return;
        }

        await this.generateCombinations();
    }

    async generateCombinations() {
        // Show loading
        this.showLoading();
        
        // Hide results if previously shown
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.classList.add('hidden');
        }

        // Simulate AI processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get form data
        const occasion = document.getElementById('occasion')?.value || '';
        const clothingType = document.getElementById('clothingType')?.value || '';
        const colorPreference = document.getElementById('colorPreference')?.value || '';

        // Generate combinations
        const combinations = this.generateAICombinations(occasion, clothingType, colorPreference);
        
        // Hide loading and show results
        this.hideLoading();
        this.displayResults(combinations);
    }

    showLoading() {
        const loadingSection = document.getElementById('loadingSection');
        if (loadingSection) {
            loadingSection.classList.remove('hidden');
            loadingSection.classList.add('fade-in');
        }
    }

    hideLoading() {
        const loadingSection = document.getElementById('loadingSection');
        if (loadingSection) {
            loadingSection.classList.add('hidden');
            loadingSection.classList.remove('fade-in');
        }
    }

    generateAICombinations(occasion, clothingType, colorPreference) {
        const combinations = [];
        const numCombinations = Math.min(Math.max(2, Math.floor(this.uploadedImages.length / 2)), 4);

        for (let i = 0; i < numCombinations; i++) {
            const combination = this.createCombination(i + 1, occasion, clothingType, colorPreference);
            combinations.push(combination);
        }

        return combinations;
    }

    createCombination(index, occasion, clothingType, colorPreference) {
        // Randomly select 2-4 images for each combination
        const numItems = Math.min(Math.max(2, Math.floor(Math.random() * 3) + 2), this.uploadedImages.length);
        const selectedImages = this.getRandomImages(numItems);
        
        // Generate realistic ratings and confidence
        const rating = Math.floor(Math.random() * 2) + 4; // 4-5 stars
        const confidence = Math.floor(Math.random() * 16) + 80; // 80-95%

        // Generate analysis based on preferences
        const colorAnalysis = this.generateColorAnalysis(colorPreference);
        const styleNotes = this.generateStyleNotes(occasion, clothingType);

        return {
            id: index,
            title: `Combination ${index}`,
            rating: rating,
            confidence: confidence,
            images: selectedImages,
            colorAnalysis: colorAnalysis,
            styleNotes: styleNotes
        };
    }

    getRandomImages(count) {
        const shuffled = [...this.uploadedImages].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    generateColorAnalysis(colorPreference) {
        const analyses = {
            'bright': [
                'Vibrant colors create an energetic and confident look',
                'Bold color choices make a strong fashion statement',
                'Bright hues add personality and visual interest'
            ],
            'dark': [
                'Deep tones create a sophisticated and elegant appearance',
                'Dark colors provide a timeless and versatile foundation',
                'Rich colors convey professionalism and refinement'
            ],
            'neutral': [
                'Neutral tones offer versatility and timeless appeal',
                'Subtle colors create a balanced and harmonious look',
                'Earth tones provide a natural and calming aesthetic'
            ],
            'pastel': [
                'Soft pastels create a gentle and romantic appearance',
                'Light colors bring freshness and femininity to the outfit',
                'Delicate hues offer a dreamy and ethereal quality'
            ],
            '': [
                'Well-coordinated colors create visual harmony',
                'Complementary tones enhance the overall aesthetic',
                'Balanced color palette ensures a cohesive look'
            ]
        };

        const options = analyses[colorPreference] || analyses[''];
        return options[Math.floor(Math.random() * options.length)];
    }

    generateStyleNotes(occasion, clothingType) {
        const notes = {
            'casual': [
                'Perfect for relaxed everyday activities and social gatherings',
                'Comfortable yet stylish for weekend outings',
                'Effortlessly chic for casual meetups and errands'
            ],
            'formal': [
                'Sophisticated ensemble suitable for business meetings',
                'Elegant combination perfect for formal events',
                'Professional appearance that commands respect'
            ],
            'party': [
                'Eye-catching outfit that stands out in social settings',
                'Fun and festive look perfect for celebrations',
                'Trendy combination that photographs beautifully'
            ],
            'business': [
                'Professional attire that projects confidence and competence',
                'Polished look suitable for corporate environments',
                'Conservative yet stylish for workplace success'
            ],
            'sports': [
                'Comfortable and functional for active pursuits',
                'Athletic-inspired look that prioritizes movement',
                'Practical combination for fitness and outdoor activities'
            ],
            'wedding': [
                'Elegant and appropriate for special celebrations',
                'Refined look that respects the formal occasion',
                'Beautiful ensemble perfect for memorable moments'
            ]
        };

        const typeNotes = {
            'shirt': 'Classic shirt styling adds sophistication',
            't-shirt': 'Casual t-shirt keeps the look relaxed and comfortable',
            'pants': 'Well-fitted pants create a polished silhouette',
            'jeans': 'Denim adds a casual, versatile element',
            'dress': 'Dress creates an instantly put-together appearance',
            'skirt': 'Skirt adds feminine flair and movement',
            'jacket': 'Layering piece adds structure and refinement',
            'sweater': 'Cozy sweater brings warmwarmth and texture'
        };

        let note = notes[occasion]?.[Math.floor(Math.random() * notes[occasion].length)] || 
                   'Stylish combination perfect for your selected occasion';
        
        if (clothingType && typeNotes[clothingType]) {
            note += '. ' + typeNotes[clothingType] + '.';
        }

        return note;
    }

    displayResults(combinations) {
        const resultsSection = document.getElementById('resultsSection');
        const combinationsGrid = document.getElementById('combinationsGrid');
        
        if (!resultsSection || !combinationsGrid) return;
        
        combinationsGrid.innerHTML = '';

        combinations.forEach(combination => {
            const combinationCard = this.createCombinationCard(combination);
            combinationsGrid.appendChild(combinationCard);
        });

        resultsSection.classList.remove('hidden');
        resultsSection.classList.add('fade-in');
        
        // Scroll to results
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    createCombinationCard(combination) {
        const card = document.createElement('div');
        card.className = 'combination-card';
        
        const stars = '★'.repeat(combination.rating) + '☆'.repeat(5 - combination.rating);
        
        const imagesHTML = combination.images.map(img => 
            `<img src="${img.src}" alt="${img.name}" />`
        ).join('');

        card.innerHTML = `
            <div class="combination-header">
                <h3 class="combination-title">${combination.title}</h3>
                <div class="combination-rating">
                    <div class="stars">${stars}</div>
                    <div class="confidence">${combination.confidence}%</div>
                </div>
            </div>
            
            <div class="combination-images">
                ${imagesHTML}
            </div>
            
            <div class="combination-analysis">
                <div class="analysis-item color-harmony">
                    <span class="analysis-label">Color Harmony</span>
                    <div class="analysis-text">${combination.colorAnalysis}</div>
                </div>
                
                <div class="analysis-item style-notes">
                    <span class="analysis-label">Style Notes</span>
                    <div class="analysis-text">${combination.styleNotes}</div>
                </div>
            </div>
        `;

        return card;
    }
}

// Initialize the application when the page loads
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new AIStyleMatcher();
    });
} else {
    app = new AIStyleMatcher();
}