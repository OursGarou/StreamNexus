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

// 2. Fetcher et Parser le CSV depuis Google Sheet
async function loadMoviesData() {
    renderSkeletons(10); // Affiche le Squelette de chargement en attendant

    try {
        const response = await fetch(GOOGLE_CSV_URL);
        if (!response.ok) throw new Error("Erreur serveur API / Google Sheets inaccessible.");
        const csvText = await response.text();
        
        // ---- PARSING DU CSV ----
        // On sépare par lignes
        const lines = csvText.split(/\r?\n/);
        if (lines.length < 2) throw new Error("Le fichier CSV est vide ou mal formaté.");
        
        // Les en-têtes (Ligne 1)
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const moviesDataArray = [];

        // Les données (Ligne 2 et au-delà)
        for(let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Expression régulière puissante pour couper aux virgules SAUF si on est entre guillemets
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            
            const obj = {};
            headers.forEach((header, index) => {
                let val = values[index] ? values[index].trim() : "";
                
                // Retirer les guillemets de protection (CSV)
                if(val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1);
                    val = val.replace(/""/g, '"'); // Gérer les guillemets échappés
                }
                
                obj[header] = val;
            });
            moviesDataArray.push(obj);
        }
        
        // Affiche !
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
        bg.style.backgroundImage = `url('${imgUrl}')`;

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
    // On remplace /view par /preview pour permettre l'intégration (streaming iframe) sans être bloqué
    let finalUrl = url;
    if (finalUrl.includes('drive.google.com') && finalUrl.includes('/view')) {
        finalUrl = finalUrl.replace('/view', '/preview');
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
