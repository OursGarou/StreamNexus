// ==========================================
// CONFIGURATION DYNAMIQUE (GOOGLE SHEETS CSV)
// ==========================================
// L'URL de sortie CSV de votre Google Sheet
const GOOGLE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRArNfS4CWW2xYWczoiLZ7kupnMBQXtBOo1xJwCSUlKQU5UJNafAFAABcp0bZt1ym5iWLk2uajCvHmN/pub?output=csv";

// --- DOM ELEMENTS ---
const navbar = document.getElementById('navbar');
const mainContent = document.getElementById('main-content');
const searchInput = document.getElementById('search-input');
const videoModal = document.getElementById('video-modal');
const closeModalBtn = document.getElementById('close-modal');
const moviePlayer = document.getElementById('movie-player'); // C'est maintenant une iframe
const cursorGlow = document.getElementById('cursor-glow');

// Garder une référence vers les éléments rendus pour la recherche
const renderedCards = [];


// ==========================================
// FONCTIONS DE CHARGEMENT & SKELETON
// ==========================================

// 1. Affiche des éléments "fantômes" (chargement)
function renderSkeletons(count = 8) {
    mainContent.innerHTML = '';
    renderedCards.length = 0; // Vider l'array

    const sizes = ['large', 'normal', 'wide', 'tall', 'normal', 'normal', 'wide', 'normal'];

    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        // On assigne une taille au hasard pour garder l'aspect asymétrique
        card.className = `bento-card bento-${sizes[i % sizes.length]} skeleton`;
        mainContent.appendChild(card);
    }
}

// 2. Parseur CSV robuste (Gère les guillemets, virgules internes, sauts de ligne)
function parseCSV(csvString) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csvString.length; i++) {
        const char = csvString[i];
        const nextChar = csvString[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            // Guillemets échappés ("")
            currentCell += '"';
            i++; 
        } else if (char === '"') {
            // Début/Fin d'un bloc de guillemets
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            // Fin de la cellule
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (char === '\n' && !inQuotes) {
            // Fin de la ligne
            if (currentCell.endsWith('\r')) currentCell = currentCell.slice(0, -1);
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            // Caractère standard
            currentCell += char;
        }
    }
    
    // Ajout de la toute dernière cellule si le fichier ne finit pas par un saut de ligne
    if (currentCell) {
        if (currentCell.endsWith('\r')) currentCell = currentCell.slice(0, -1);
        currentRow.push(currentCell.trim());
    }
    if (currentRow.length > 0) {
        rows.push(currentRow);
    }
    
    return rows;
}

// 3. Fetcher les données depuis Google Sheet
async function loadMoviesData() {
    renderSkeletons(10); // Affiche le Squelette de chargement en attendant

    try {
        // Cache Busting : ajoute un paramètre de temps à la fin de l'URL pour forcer la mise à jour
        const cacheSeparator = GOOGLE_CSV_URL.includes('?') ? '&' : '?';
        const finalUrl = GOOGLE_CSV_URL + cacheSeparator + "t=" + new Date().getTime();  
        
        // { cache: 'no-store' } indique aussi au navigateur de ne pas mettre en cache
        const response = await fetch(finalUrl, { cache: "no-store" });
        if (!response.ok) throw new Error("Erreur serveur API / Google Sheets inaccessible.");
        
        const csvText = await response.text();
        
        // ---- PARSING DU CSV ----
        const rows = parseCSV(csvText);
        if (rows.length < 2) throw new Error("Le fichier CSV est vide ou mal formaté.");
        
        const headers = rows[0];
        const moviesDataArray = [];

        // Traitement des données (En commençant à la ligne 2)
        for(let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Ignorer les lignes totalement vides
            if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
            
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] ? row[index] : "";
            });
            moviesDataArray.push(obj);
        }
        
        // Démarre le rendu de l'interface
        renderBentoGrid(moviesDataArray);

    } catch (error) {
        console.error("Erreur de récupération des films :", error);
        mainContent.innerHTML = `<p style='color:red; text-align:center;'>Erreur de chargement du catalogue ("${error.message}")</p>`;
    }
}


// ==========================================
// MOTEUR DE RENDU (GRID BENTO & 3D)
// ==========================================

function renderBentoGrid(movies) {
    mainContent.innerHTML = ''; // Nettoyer les Squelettes
    renderedCards.length = 0;   // Nettoyer l'index de recherche
    
    movies.forEach(movie => {
        // Extraction des valeurs selon les en-têtes potentiels
        const title = movie.Titre || movie.titre || "Inconnu";
        const year = movie.Annee || movie.Année || movie.annee || "";
        const sizeRaw = movie.Taille || movie.taille || "normal";
        const sizeClass = sizeRaw.toLowerCase().trim();
        const imgUrl = movie.Image_URL || movie.image_url || movie.Image || "";
        const vidUrl = movie.Video_URL || movie.video_url || movie.Video || "";

        // Wrapper principal de la carte
        const card = document.createElement('div');
        card.className = `bento-card bento-${sizeClass}`;
        
        // Conteneur intérieur poour l'animation 3D
        const inner = document.createElement('div');
        inner.classList.add('bento-inner');

        // Image de fond
        const bg = document.createElement('div');
        bg.classList.add('bento-bg');
        // Nettoyage pour ignorer les espaces accidentels
        const cleanImgUrl = imgUrl.trim();
        bg.style.backgroundImage = "url('" + cleanImgUrl + "')";

        // Overlay d'informations
        const overlay = document.createElement('div');
        overlay.classList.add('bento-overlay');
        overlay.innerHTML = `
            <p>${year}</p>
            <h3>${title}</h3>
        `;

        inner.appendChild(bg);
        inner.appendChild(overlay);
        card.appendChild(inner);

        // Interaction d'ouverture vidéo (Iframe Google Drive)
        card.addEventListener('click', () => openVideo(vidUrl));

        // --- EFFET 3D PARALLAXE AU SURVOL ---
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -15; 
            const rotateY = ((x - centerX) / centerX) * 15;
            inner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            inner.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
        });
        
        // Stocker pour la recherche live
        renderedCards.push({
            element: card,
            title: title.toLowerCase()
        });

        mainContent.appendChild(card);
    });
}


// ==========================================
// FONCTIONNALITÉS GLOBALES (UI)
// ==========================================

// Logique de recherche en temps réel
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    renderedCards.forEach(cardData => {
        if (cardData.title.includes(searchTerm)) {
            cardData.element.style.display = 'block';
        } else {
            cardData.element.style.display = 'none';
        }
    });
});

// Apparence Navbar au défilement
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Curseur Lumineux
document.addEventListener('mousemove', (e) => {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
});

// Outil Vidéo Iframe
function openVideo(url) {
    if(!url || url.trim() === "null" || url.trim() === "") {
        alert("Ce fichier n'a pas encore de lien vidéo.");
        return;
    }

    // Gestion Intelligente des liens Google Drive
    // Remplace automatiquement la fin des liens par /preview pour permettre le streaming direct
    let finalUrl = url.trim();
    if (finalUrl.includes('drive.google.com')) {
        finalUrl = finalUrl.replace('/view', '/preview')
                           .replace('/edit', '/preview')
                           .replace('/open', '/preview');
    }

    moviePlayer.src = finalUrl;
    videoModal.classList.add('active');
}

function closeVideo() {
    videoModal.classList.remove('active');
    
    // IMPORTANT: Vider l'iframe empêche la vidéo ou l'audio de continuer en arrière-plan
    moviePlayer.src = ''; 
}

closeModalBtn.addEventListener('click', closeVideo);

videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) closeVideo();
});

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && videoModal.classList.contains('active')) closeVideo();
});

// INITIALISATION
document.addEventListener('DOMContentLoaded', () => {
    loadMoviesData();
});
