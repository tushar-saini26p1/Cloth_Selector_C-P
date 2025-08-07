# AI Clothing Combination Project - Complete Files

## Flask Backend (app.py)

```python
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os
import cv2
import numpy as np
from werkzeug.utils import secure_filename
from PIL import Image, ImageDraw
import base64
import io
import json
from datetime import datetime
import uuid
from sklearn.cluster import KMeans
import colorsys
import webcolors
import requests

app = Flask(__name__)
CORS(app)

# Configuration
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

# Create upload directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_dominant_colors(image_path, num_colors=5):
    """Extract dominant colors from an image using K-means clustering"""
    try:
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            return []
        
        # Convert BGR to RGB
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Reshape image to be a list of pixels
        pixels = image.reshape(-1, 3)
        
        # Apply K-means clustering
        kmeans = KMeans(n_clusters=num_colors, random_state=42, n_init=10)
        kmeans.fit(pixels)
        
        # Get the dominant colors
        colors = kmeans.cluster_centers_.astype(int)
        
        # Convert to hex colors
        hex_colors = []
        for color in colors:
            hex_color = '#{:02x}{:02x}{:02x}'.format(color[0], color[1], color[2])
            hex_colors.append(hex_color)
        
        return hex_colors
    except Exception as e:
        print(f"Error extracting colors: {e}")
        return ['#000000', '#FFFFFF']

def get_color_name(hex_color):
    """Get the closest color name for a hex color"""
    try:
        # Convert hex to RGB
        rgb = tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))
        
        # Try to get exact match
        try:
            return webcolors.rgb_to_name(rgb)
        except ValueError:
            # Find closest match
            min_colors = {}
            for key, name in webcolors.CSS3_HEX_TO_NAMES.items():
                r_c, g_c, b_c = webcolors.hex_to_rgb(key)
                rd = (r_c - rgb[0]) ** 2
                gd = (g_c - rgb[1]) ** 2
                bd = (b_c - rgb[2]) ** 2
                min_colors[(rd + gd + bd)] = name
            return min_colors[min(min_colors.keys())]
    except:
        return "unknown"

def analyze_color_harmony(colors):
    """Analyze color harmony between multiple colors"""
    if len(colors) < 2:
        return "monochrome"
    
    # Convert hex to HSV for better color analysis
    hsv_colors = []
    for hex_color in colors:
        rgb = tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))
        hsv = colorsys.rgb_to_hsv(rgb[0]/255, rgb[1]/255, rgb[2]/255)
        hsv_colors.append(hsv)
    
    # Analyze hue differences
    hues = [hsv[0] * 360 for hsv in hsv_colors]
    
    # Check for complementary colors (opposite on color wheel)
    for i in range(len(hues)):
        for j in range(i+1, len(hues)):
            hue_diff = abs(hues[i] - hues[j])
            if 160 <= hue_diff <= 200:
                return "complementary"
    
    # Check for analogous colors (adjacent on color wheel)
    hue_range = max(hues) - min(hues)
    if hue_range <= 60:
        return "analogous"
    elif hue_range <= 120:
        return "triadic"
    else:
        return "diverse"

def detect_clothing_type(image_path):
    """Basic clothing type detection using image analysis"""
    try:
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            return "unknown"
        
        # Get image dimensions
        height, width = image.shape[:2]
        aspect_ratio = height / width
        
        # Simple heuristics based on aspect ratio and size
        if aspect_ratio > 1.5:
            return "dress" if aspect_ratio > 2.0 else "shirt"
        elif aspect_ratio < 0.8:
            return "pants"
        else:
            return "top"
    except:
        return "unknown"

def calculate_outfit_score(images_data, occasion, color_preference):
    """Calculate compatibility score for outfit combination"""
    base_score = 70
    
    # Extract all colors from images
    all_colors = []
    for img_data in images_data:
        all_colors.extend(img_data.get('colors', []))
    
    if not all_colors:
        return base_score
    
    # Analyze color harmony
    harmony = analyze_color_harmony(all_colors)
    harmony_scores = {
        'complementary': 95,
        'analogous': 90,
        'triadic': 85,
        'monochrome': 80,
        'diverse': 75
    }
    
    color_score = harmony_scores.get(harmony, 70)
    
    # Occasion-based adjustments
    occasion_multipliers = {
        'formal': 0.9 if harmony in ['complementary', 'monochrome'] else 0.8,
        'casual': 0.95,
        'party': 0.95 if harmony in ['complementary', 'diverse'] else 0.85,
        'business': 0.9 if harmony in ['monochrome', 'analogous'] else 0.8,
        'sports': 0.9,
        'wedding': 0.95 if harmony == 'complementary' else 0.85
    }
    
    final_score = color_score * occasion_multipliers.get(occasion, 0.9)
    return min(95, max(65, int(final_score)))

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/upload', methods=['POST'])
def upload_images():
    """Handle image uploads and extract features"""
    try:
        if 'images' not in request.files:
            return jsonify({'error': 'No images provided'}), 400
        
        files = request.files.getlist('images')
        
        if not files or all(file.filename == '' for file in files):
            return jsonify({'error': 'No images selected'}), 400
        
        processed_images = []
        
        for file in files:
            if file and allowed_file(file.filename):
                # Generate unique filename
                filename = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                
                # Save file
                file.save(filepath)
                
                # Extract features
                colors = extract_dominant_colors(filepath)
                clothing_type = detect_clothing_type(filepath)
                
                # Get color names
                color_names = [get_color_name(color) for color in colors[:3]]
                
                image_data = {
                    'id': str(uuid.uuid4()),
                    'filename': filename,
                    'original_name': file.filename,
                    'colors': colors,
                    'color_names': color_names,
                    'clothing_type': clothing_type,
                    'url': f'/uploads/{filename}'
                }
                
                processed_images.append(image_data)
        
        return jsonify({
            'success': True,
            'images': processed_images,
            'message': f'Successfully processed {len(processed_images)} images'
        })
    
    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/api/generate-combinations', methods=['POST'])
def generate_combinations():
    """Generate outfit combinations using AI logic"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        images_data = data.get('images', [])
        occasion = data.get('occasion', 'casual')
        clothing_type = data.get('clothingType', '')
        color_preference = data.get('colorPreference', '')
        
        if len(images_data) < 2:
            return jsonify({'error': 'At least 2 images required for combinations'}), 400
        
        # Generate different combinations
        combinations = []
        num_combinations = min(4, len(images_data))
        
        for i in range(num_combinations):
            # Select 2-4 images for each combination
            combo_size = min(4, max(2, len(images_data) - i))
            selected_images = images_data[i:i+combo_size]
            
            if len(selected_images) < combo_size:
                selected_images.extend(images_data[:combo_size-len(selected_images)])
            
            # Calculate compatibility score
            score = calculate_outfit_score(selected_images, occasion, color_preference)
            
            # Analyze colors in combination
            all_colors = []
            for img in selected_images:
                all_colors.extend(img.get('colors', [])[:2])  # Take top 2 colors per image
            
            harmony = analyze_color_harmony(all_colors)
            
            # Generate style notes
            style_notes = generate_style_notes(selected_images, occasion, clothing_type, harmony)
            
            combination = {
                'id': i + 1,
                'images': selected_images,
                'score': score,
                'rating': min(5, max(1, int(score / 20) + 1)),
                'harmony': harmony,
                'style_notes': style_notes,
                'color_analysis': f"{harmony.title()} color scheme with {len(set(all_colors))} distinct colors",
                'recommendation': get_recommendation_text(score, harmony, occasion)
            }
            
            combinations.append(combination)
        
        # Sort by score (highest first)
        combinations.sort(key=lambda x: x['score'], reverse=True)
        
        return jsonify({
            'success': True,
            'combinations': combinations,
            'total_combinations': len(combinations)
        })
    
    except Exception as e:
        return jsonify({'error': f'Generation failed: {str(e)}'}), 500

def generate_style_notes(images, occasion, clothing_type, harmony):
    """Generate contextual style notes for the combination"""
    notes = []
    
    # Color harmony note
    harmony_notes = {
        'complementary': 'Bold and striking color contrast creates visual interest',
        'analogous': 'Harmonious color flow creates a sophisticated look',
        'triadic': 'Balanced three-color scheme offers vibrant yet coordinated styling',
        'monochrome': 'Elegant single-color palette with tonal variations',
        'diverse': 'Eclectic color mix brings creative energy to the outfit'
    }
    notes.append(harmony_notes.get(harmony, 'Unique color combination'))
    
    # Occasion-specific notes
    occasion_notes = {
        'formal': 'Perfect for professional settings and formal events',
        'casual': 'Great for everyday wear and relaxed occasions',
        'party': 'Eye-catching combination perfect for social gatherings',
        'business': 'Professional yet stylish for workplace environments',
        'sports': 'Comfortable and functional for active pursuits',
        'wedding': 'Elegant and celebratory for special occasions'
    }
    notes.append(occasion_notes.get(occasion, 'Versatile styling option'))
    
    # Clothing type note
    if clothing_type:
        notes.append(f'Emphasizes {clothing_type} as the focal point')
    
    return ' • '.join(notes)

def get_recommendation_text(score, harmony, occasion):
    """Generate recommendation text based on score and analysis"""
    if score >= 90:
        return f"Excellent choice! This {harmony} combination is perfect for {occasion} occasions."
    elif score >= 80:
        return f"Great combination with {harmony} colors that works well for {occasion} settings."
    elif score >= 70:
        return f"Good pairing with {harmony} styling suitable for {occasion} events."
    else:
        return f"Interesting {harmony} combination that could work for {occasion} with the right accessories."

@app.route('/api/analyze-image', methods=['POST'])
def analyze_single_image():
    """Analyze a single image for detailed information"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        
        if not file or not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type'}), 400
        
        # Generate unique filename
        filename = f"temp_{uuid.uuid4()}_{secure_filename(file.filename)}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # Save file temporarily
        file.save(filepath)
        
        # Extract detailed features
        colors = extract_dominant_colors(filepath, num_colors=8)
        clothing_type = detect_clothing_type(filepath)
        color_names = [get_color_name(color) for color in colors[:5]]
        
        # Get image dimensions
        image = Image.open(filepath)
        width, height = image.size
        
        # Clean up temp file
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'analysis': {
                'colors': colors,
                'color_names': color_names,
                'clothing_type': clothing_type,
                'dimensions': {'width': width, 'height': height},
                'dominant_color': colors[0] if colors else '#000000',
                'color_diversity': len(set(colors))
            }
        })
    
    except Exception as e:
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

## HTML Template (templates/index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Clothing Combination</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body>
    <div class="container">
        <header>
            <h1>AI Clothing Combination</h1>
            <p>Upload your clothes and get the perfect outfit suggestions!</p>
        </header>

        <div class="upload-section">
            <h2>Upload Your Clothes</h2>
            
            <div class="upload-area" id="uploadArea">
                <div class="upload-content">
                    <i class="upload-icon">📸</i>
                    <p>Drag & drop your clothing images here or <span class="browse-text">browse files</span></p>
                    <input type="file" id="fileInput" multiple accept="image/*" style="display: none;">
                </div>
            </div>

            <div class="uploaded-images" id="uploadedImages">
                <!-- Uploaded images will appear here -->
            </div>
        </div>

        <div class="selection-section">
            <h2>Select Clothing Details</h2>
            
            <div class="form-group">
                <label for="occasion">Occasion:</label>
                <select id="occasion">
                    <option value="">Select Occasion</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                    <option value="party">Party</option>
                    <option value="business">Business</option>
                    <option value="sports">Sports</option>
                    <option value="wedding">Wedding</option>
                </select>
            </div>

            <div class="form-group">
                <label for="clothingType">Preferred Clothing Type:</label>
                <select id="clothingType">
                    <option value="">Select Type</option>
                    <option value="shirt">Shirt</option>
                    <option value="t-shirt">T-Shirt</option>
                    <option value="pants">Pants</option>
                    <option value="jeans">Jeans</option>
                    <option value="dress">Dress</option>
                    <option value="skirt">Skirt</option>
                    <option value="jacket">Jacket</option>
                    <option value="sweater">Sweater</option>
                </select>
            </div>

            <div class="form-group">
                <label for="colorPreference">Color Preference:</label>
                <select id="colorPreference">
                    <option value="">No Preference</option>
                    <option value="bright">Bright Colors</option>
                    <option value="dark">Dark Colors</option>
                    <option value="neutral">Neutral Colors</option>
                    <option value="pastel">Pastel Colors</option>
                </select>
            </div>
        </div>

        <div class="action-section">
            <button id="generateBtn" class="generate-btn" disabled>
                <span class="btn-text">Generate Combinations</span>
                <span class="loader" id="loader"></span>
            </button>
        </div>

        <div class="results-section" id="resultsSection">
            <h2>Recommended Combinations</h2>
            <div class="combinations-container" id="combinationsContainer">
                <!-- AI generated combinations will appear here -->
            </div>
        </div>

        <!-- Status Messages -->
        <div id="statusMessages"></div>
    </div>

    <script src="{{ url_for('static', filename='js/script.js') }}"></script>
</body>
</html>
```

## JavaScript (static/js/script.js)

```javascript
// AI Clothing Combination - Frontend JavaScript with Backend Integration

// Global variables
let uploadedImages = [];
let currentCombinations = [];
const API_BASE_URL = '';  // Empty for same origin

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadedImagesContainer = document.getElementById('uploadedImages');
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
    checkBackendHealth();
});

// Check if backend is running
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
            showSuccess('Backend connected successfully!');
        }
    } catch (error) {
        showError('Backend connection failed. Please ensure the Flask server is running.');
    }
}

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
    colorPreference.addEventListener('change', updateGenerateButton);
}

// Handle file selection
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    uploadImagesToBackend(files);
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
        uploadImagesToBackend(imageFiles);
    } else {
        showError('Please drop only image files.');
    }
}

// Upload images to backend for processing
async function uploadImagesToBackend(files) {
    try {
        // Show loading state
        showLoading('Uploading and analyzing images...');
        
        const formData = new FormData();
        files.forEach(file => {
            formData.append('images', file);
        });
        
        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Add processed images to our array
            uploadedImages.push(...result.images);
            displayUploadedImages();
            updateGenerateButton();
            showSuccess(`Successfully processed ${result.images.length} images`);
        } else {
            showError(result.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showError('Failed to upload images. Please check your connection.');
    } finally {
        hideLoading();
    }
}

// Display uploaded images
function displayUploadedImages() {
    uploadedImagesContainer.innerHTML = '';
    
    uploadedImages.forEach((imageData, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        // Create color palette display
        const colorPalette = imageData.colors.slice(0, 3).map(color => 
            `<div class="color-dot" style="background-color: ${color}" title="${color}"></div>`
        ).join('');
        
        imageItem.innerHTML = `
            <img src="${imageData.url}" alt="${imageData.original_name}" loading="lazy">
            <div class="image-info">
                <div class="image-name">${imageData.original_name}</div>
                <div class="image-type">${imageData.clothing_type}</div>
                <div class="color-palette">${colorPalette}</div>
            </div>
            <button class="remove-btn" onclick="removeImage(${index})" title="Remove image">×</button>
        `;
        
        uploadedImagesContainer.appendChild(imageItem);
    });
}

// Remove image
function removeImage(index) {
    uploadedImages.splice(index, 1);
    displayUploadedImages();
    updateGenerateButton();
}

// Update generate button state
function updateGenerateButton() {
    const hasImages = uploadedImages.length >= 2;
    const hasOccasion = occasion.value !== '';
    
    generateBtn.disabled = !(hasImages && hasOccasion);
    
    if (!hasImages) {
        generateBtn.textContent = 'Upload at least 2 images';
    } else if (!hasOccasion) {
        generateBtn.textContent = 'Select an occasion';
    } else {
        generateBtn.innerHTML = '<span class="btn-text">Generate Combinations</span><span class="loader" id="loader"></span>';
    }
}

// Generate combinations using backend AI
async function generateCombinations() {
    if (uploadedImages.length < 2) {
        showError('Please upload at least 2 clothing items.');
        return;
    }
    
    if (!occasion.value) {
        showError('Please select an occasion.');
        return;
    }
    
    try {
        // Show loading state
        generateBtn.classList.add('loading');
        generateBtn.disabled = true;
        showLoading('AI is analyzing your clothes and creating perfect combinations...');
        
        const requestData = {
            images: uploadedImages,
            occasion: occasion.value,
            clothingType: clothingType.value,
            colorPreference: colorPreference.value
        };
        
        const response = await fetch(`${API_BASE_URL}/api/generate-combinations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentCombinations = result.combinations;
            displayCombinations(result.combinations);
            
            // Show results section
            resultsSection.classList.add('show');
            resultsSection.scrollIntoView({ behavior: 'smooth' });
            
            showSuccess(`Generated ${result.combinations.length} outfit combinations!`);
        } else {
            showError(result.error || 'Failed to generate combinations');
        }
    } catch (error) {
        console.error('Generation error:', error);
        showError('Failed to generate combinations. Please try again.');
    } finally {
        // Hide loading state
        generateBtn.classList.remove('loading');
        updateGenerateButton();
        hideLoading();
    }
}

// Display combinations
function displayCombinations(combinations) {
    combinationsContainer.innerHTML = '';
    
    combinations.forEach(combination => {
        const card = document.createElement('div');
        card.className = 'combination-card';
        
        // Create star rating
        const starsHtml = '★'.repeat(combination.rating) + '☆'.repeat(5 - combination.rating);
        
        // Create images display
        const imagesHtml = combination.images.map(img => `
            <div class="combo-image-wrapper">
                <img src="${img.url}" alt="${img.original_name}" class="combo-image">
                <div class="image-label">${img.clothing_type}</div>
            </div>
        `).join('');
        
        // Create color analysis
        const allColors = combination.images.flatMap(img => img.colors.slice(0, 2));
        const colorDotsHtml = allColors.slice(0, 6).map(color => 
            `<div class="color-dot large" style="background-color: ${color}" title="${color}"></div>`
        ).join('');
        
        card.innerHTML = `
            <div class="combination-header">
                <div class="combination-rating">
                    <span class="stars">${starsHtml}</span>
                    <span class="score">${combination.score}% match</span>
                </div>
                <div class="combination-id">Outfit #${combination.id}</div>
            </div>
            
            <div class="combination-images">
                ${imagesHtml}
            </div>
            
            <div class="combination-colors">
                <h4>Color Palette</h4>
                <div class="color-palette-display">${colorDotsHtml}</div>
            </div>
            
            <div class="combination-details">
                <h4>${combination.harmony} Harmony</h4>
                <p class="color-analysis">${combination.color_analysis}</p>
                <p class="style-notes">${combination.style_notes}</p>
                <p class="recommendation">${combination.recommendation}</p>
            </div>
            
            <div class="combination-actions">
                <button class="action-btn primary" onclick="saveOutfit(${combination.id})">
                    Save Outfit
                </button>
                <button class="action-btn secondary" onclick="shareOutfit(${combination.id})">
                    Share
                </button>
            </div>
        `;
        
        combinationsContainer.appendChild(card);
    });
}

// Save outfit (placeholder function)
function saveOutfit(combinationId) {
    const combination = currentCombinations.find(c => c.id === combinationId);
    if (combination) {
        showSuccess(`Outfit #${combinationId} saved to your collection!`);
        // Here you would typically save to localStorage or send to backend
        localStorage.setItem(`outfit_${combinationId}`, JSON.stringify(combination));
    }
}

// Share outfit (placeholder function)
function shareOutfit(combinationId) {
    const combination = currentCombinations.find(c => c.id === combinationId);
    if (combination && navigator.share) {
        navigator.share({
            title: `AI Generated Outfit #${combinationId}`,
            text: `Check out this ${combination.harmony} outfit combination!`,
            url: window.location.href
        });
    } else {
        // Fallback - copy to clipboard
        const shareText = `Check out this AI-generated outfit combination! Score: ${combination.score}% match`;
        navigator.clipboard.writeText(shareText).then(() => {
            showSuccess('Outfit details copied to clipboard!');
        });
    }
}

// Utility functions for UI feedback
function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}

function showLoading(message) {
    showMessage(message, 'loading');
}

function hideLoading() {
    document.querySelectorAll('.loading-message').forEach(el => el.remove());
}

function showMessage(message, type) {
    // Remove existing messages of the same type
    document.querySelectorAll(`.${type}-message`).forEach(el => el.remove());
    
    const messageEl = document.createElement('div');
    messageEl.className = `status-message ${type}-message show`;
    messageEl.innerHTML = `
        <div class="message-content">
            ${type === 'loading' ? '<div class="spinner"></div>' : ''}
            <span class="message-text">${message}</span>
        </div>
    `;
    
    const statusMessages = document.getElementById('statusMessages');
    statusMessages.appendChild(messageEl);
    
    // Auto hide after 5 seconds (except loading messages)
    if (type !== 'loading') {
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => messageEl.remove(), 300);
        }, 5000);
    }
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + U to trigger upload
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        fileInput.click();
    }
    
    // Enter to generate combinations if ready
    if (e.key === 'Enter' && !generateBtn.disabled) {
        generateCombinations();
    }
});

// Export for debugging
window.clothingApp = {
    uploadedImages,
    currentCombinations,
    generateCombinations,
    uploadImagesToBackend
};
```

## CSS Styling (static/css/style.css)

```css
/* AI Clothing Combination - Updated CSS with Backend Features */

/* Reset and base styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* Header */
header {
    text-align: center;
    margin-bottom: 40px;
    color: white;
}

header h1 {
    font-size: 2.8rem;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    font-weight: 700;
}

header p {
    font-size: 1.2rem;
    opacity: 0.9;
    font-weight: 300;
}

/* Card styles */
.upload-section,
.selection-section,
.results-section {
    background: white;
    border-radius: 20px;
    padding: 30px;
    margin-bottom: 30px;
    box-shadow: 0 15px 35px rgba(0,0,0,0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
}

.upload-section h2,
.selection-section h2,
.results-section h2 {
    margin-bottom: 25px;
    color: #333;
    font-size: 1.8rem;
    font-weight: 600;
}

/* Upload Area */
.upload-area {
    border: 3px dashed #667eea;
    border-radius: 15px;
    padding: 50px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: linear-gradient(145deg, #f8f9ff 0%, #f0f2ff 100%);
    position: relative;
    overflow: hidden;
}

.upload-area:hover {
    border-color: #764ba2;
    background: linear-gradient(145deg, #f0f2ff 0%, #e8ebff 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
}

.upload-area.dragover {
    border-color: #764ba2;
    background: linear-gradient(145deg, #e8ebff 0%, #dce1ff 100%);
    transform: scale(1.02);
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
}

.upload-content {
    pointer-events: none;
}

.upload-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 20px;
    animation: float 3s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}

.upload-area p {
    font-size: 1.2rem;
    color: #666;
    margin-bottom: 10px;
}

.browse-text {
    color: #667eea;
    font-weight: bold;
    text-decoration: underline;
    cursor: pointer;
}

/* Uploaded Images */
.uploaded-images {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 25px;
}

.image-item {
    position: relative;
    border-radius: 15px;
    overflow: hidden;
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
}

.image-item:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
}

.image-item img {
    width: 100%;
    height: 180px;
    object-fit: cover;
}

.image-info {
    padding: 15px;
    background: white;
}

.image-name {
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
    margin-bottom: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.image-type {
    color: #667eea;
    font-size: 0.8rem;
    font-weight: 500;
    text-transform: capitalize;
    margin-bottom: 10px;
}

.color-palette {
    display: flex;
    gap: 5px;
}

.color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.color-dot.large {
    width: 20px;
    height: 20px;
}

.remove-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255,0,0,0.9);
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    font-weight: bold;
}

.remove-btn:hover {
    background: rgba(255,0,0,1);
    transform: scale(1.1);
}

/* Form Styles */
.form-group {
    margin-bottom: 25px;
}

.form-group label {
    display: block;
    margin-bottom: 10px;
    font-weight: 600;
    color: #555;
    font-size: 1rem;
}

.form-group select {
    width: 100%;
    padding: 15px;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    font-size: 1rem;
    background: white;
    transition: all 0.3s ease;
    cursor: pointer;
}

.form-group select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Action Section */
.action-section {
    text-align: center;
    margin-bottom: 30px;
}

.generate-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 18px 45px;
    font-size: 1.2rem;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
    min-width: 250px;
    justify-content: center;
}

.generate-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
}

.generate-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

.loader {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: none;
}

.generate-btn.loading .loader {
    display: block;
}

.generate-btn.loading .btn-text {
    display: none;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Results Section */
.results-section {
    display: none;
    animation: slideInUp 0.5s ease-out;
}

.results-section.show {
    display: block;
}

@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.combinations-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 25px;
}

.combination-card {
    border: 2px solid #e0e0e0;
    border-radius: 20px;
    padding: 25px;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
    position: relative;
    overflow: hidden;
}

.combination-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.combination-card:hover {
    border-color: #667eea;
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}

.combination-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.combination-rating {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.stars {
    color: #ffd700;
    font-size: 1.4rem;
    margin-bottom: 5px;
}

.score {
    font-size: 0.9rem;
    color: #667eea;
    font-weight: 600;
}

.combination-id {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
}

.combination-images {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.combo-image-wrapper {
    position: relative;
}

.combo-image {
    width: 80px;
    height: 80px;
    border-radius: 12px;
    object-fit: cover;
    border: 3px solid #e0e0e0;
    transition: all 0.3s ease;
}

.combo-image:hover {
    border-color: #667eea;
    transform: scale(1.05);
}

.image-label {
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    white-space: nowrap;
}

.combination-colors {
    margin-bottom: 20px;
    text-align: left;
}

.combination-colors h4 {
    color: #333;
    margin-bottom: 10px;
    font-size: 1rem;
}

.color-palette-display {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
}

.combination-details {
    text-align: left;
    margin-bottom: 20px;
}

.combination-details h4 {
    color: #667eea;
    margin-bottom: 10px;
    font-size: 1.1rem;
}

.combination-details p {
    margin-bottom: 12px;
    line-height: 1.5;
    color: #555;
}

.color-analysis {
    font-weight: 500;
}

.style-notes {
    font-style: italic;
    color: #666;
}

.recommendation {
    background: linear-gradient(145deg, #f8f9ff 0%, #f0f2ff 100%);
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid #667eea;
    font-weight: 500;
}

/* Action Buttons */
.combination-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
}

.action-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 25px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
    font-size: 0.9rem;
}

.action-btn.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.action-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.action-btn.secondary {
    background: transparent;
    color: #667eea;
    border: 2px solid #667eea;
}

.action-btn.secondary:hover {
    background: #667eea;
    color: white;
}

/* Status Messages */
#statusMessages {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-width: 400px;
}

.status-message {
    margin-bottom: 10px;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    transform: translateX(100%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 12px;
}

.status-message.show {
    transform: translateX(0);
}

.success-message {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.error-message {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
}

.loading-message {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.message-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

/* Responsive Design */
@media (max-width: 768px) {
    .container {
        padding: 15px;
    }
    
    header h1 {
        font-size: 2.2rem;
    }
    
    .upload-section,
    .selection-section,
    .results-section {
        padding: 20px;
    }
    
    .upload-area {
        padding: 30px 20px;
    }
    
    .uploaded-images {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
    
    .combinations-container {
        grid-template-columns: 1fr;
    }
    
    .combination-images {
        gap: 10px;
    }
    
    .combo-image {
        width: 60px;
        height: 60px;
    }
    
    #statusMessages {
        left: 15px;
        right: 15px;
        max-width: none;
    }
    
    .generate-btn {
        min-width: 200px;
        padding: 15px 35px;
        font-size: 1rem;
    }
}

@media (max-width: 480px) {
    .combination-actions {
        flex-direction: column;
    }
    
    .action-btn {
        width: 100%;
    }
    
    .combination-header {
        flex-direction: column;
        gap: 10px;
        text-align: center;
    }
}

/* Hidden utility class */
.hidden {
    display: none !important;
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* Focus styles for keyboard navigation */
.upload-area:focus-within,
select:focus,
button:focus {
    outline: 2px solid #667eea;
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .upload-area {
        border-width: 4px;
    }
    
    .combination-card {
        border-width: 3px;
    }
}
```

## Requirements (requirements.txt)

```
Flask==2.3.3
Flask-CORS==4.0.0
opencv-python==4.8.1.78
numpy==1.24.3
Pillow==10.0.0
scikit-learn==1.3.0
webcolors==1.13
Werkzeug==2.3.7
requests==2.31.0
```

## Setup Instructions

### Linux/Mac (setup.sh)
```bash
#!/bin/bash

echo "🎯 AI Clothing Combination Project Setup"
echo "========================================"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.7 or higher."
    exit 1
fi

# Check Python version
python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✅ Python $python_version detected"

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p uploads

# Set environment variables
echo "🔧 Setting up environment..."
export FLASK_APP=app.py
export FLASK_ENV=development

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo "   1. Activate virtual environment: source venv/bin/activate"
echo "   2. Run the Flask server: python app.py"
echo "   3. Open your browser to: http://localhost:5000"
```

### Windows (setup.bat)
```batch
@echo off
echo 🎯 AI Clothing Combination Project Setup
echo ========================================

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.7 or higher.
    pause
    exit /b 1
)

echo ✅ Python detected

REM Create virtual environment
echo 📦 Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo 🔄 Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo ⬆️ Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Create uploads directory
echo 📁 Creating uploads directory...
if not exist "uploads" mkdir uploads

REM Set environment variables
set FLASK_APP=app.py
set FLASK_ENV=development

echo.
echo ✅ Setup complete!
echo.
echo 🚀 To start the application:
echo    1. Activate virtual environment: venv\Scripts\activate.bat
echo    2. Run the Flask server: python app.py
echo    3. Open your browser to: http://localhost:5000
pause
```

## How to Use

1. **Setup**: Run the appropriate setup script for your OS
2. **Start**: Run `python app.py` to start the Flask server  
3. **Access**: Open `http://localhost:5000` in your browser
4. **Upload**: Drag and drop clothing images or click to browse
5. **Configure**: Select occasion, clothing type, and color preferences
6. **Generate**: Click "Generate Combinations" to get AI recommendations
7. **View**: See outfit suggestions with detailed analysis and ratings