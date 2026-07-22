import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDtFpBAuZ_3JHmMXq1uVShq4sm0zK9xqEI",
    authDomain: "tinhdiemtheog.firebaseapp.com",
    projectId: "tinhdiemtheog",
    storageBucket: "tinhdiemtheog.firebasestorage.app",
    messagingSenderId: "52564586448",
    appId: "1:52564586448:web:983bdc321423b81f5a53d5",
    measurementId: "G-PFTMHMTF6J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const loginButton = document.getElementById('google-login-btn');
const errorMessage = document.getElementById('error-message');
const loadingSpinner = document.getElementById('loading-spinner');

// Set persistence
setPersistence(auth, browserLocalPersistence);

// Save user to Firestore
const saveUserToFirestore = async (user) => {
    try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        let isAdmin = false;
        if (userDoc.exists()) {
            isAdmin = userDoc.data().isAdmin || false;
        }

        if (!userDoc.exists()) {
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || "",
                photoURL: user.photoURL || "",
                provider: user.providerData[0]?.providerId || "google.com",
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                isAdmin: isAdmin,
                status: "active",
                role: isAdmin ? "admin" : "viewer"
            };

            await setDoc(userRef, userData);
            console.log(`User saved to Firestore (Role: ${isAdmin ? 'admin' : 'viewer'})`);
        } else {
            await setDoc(userRef, {
                lastLoginAt: new Date().toISOString(),
                role: userDoc.data().role
            }, { merge: true });
        }

        return { success: true, isAdmin: isAdmin };
    } catch (error) {
        console.error("Error saving user:", error);
        return { success: false, error: error };
    }
};

// Check auth status
const checkAuthStatus = async (user) => {
    if (user) {
        // Check user status before allowing login
        try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();

                // Check if user is banned using status field
                if (userData.status === 'banned') {
                    // Sign out the user
                    await auth.signOut();

                    // Show banned message
                    displayError("❌ Tài khoản của bạn đã bị cấm. Vui lòng liên hệ admin để biết thêm chi tiết.");
                    loginButton.classList.remove('hidden');
                    loadingSpinner.classList.remove('show');
                    return;
                }
            }
        } catch (error) {
            console.error("Error checking user status:", error);
        }

        const saveResult = await saveUserToFirestore(user);

        if (saveResult.success) {
            // Success animation
            gsap.to('body', {
                duration: 0.5,
                background: "linear-gradient(135deg, #0a0a14 0%, #1a1a2a 50%, #0a0a14 100%)",
                ease: "power2.inOut"
            });

            // Speed up animations
            gsap.to('.speed-line', {
                animationDuration: '0.2s',
                duration: 0.5
            });

            gsap.to('.floating', {
                y: -100,
                opacity: 0,
                duration: 0.8,
                ease: "power2.in",
                onComplete: () => {
                    window.location.href = "index.html";
                }
            });
        } else {
            displayError("Failed to save user data");
        }
    } else {
        loginButton.classList.remove('hidden');
        loadingSpinner.classList.remove('show');
    }
};

// Button press effect compatibility
function buttonPressEffect(button) {
    if (typeof gsap !== 'undefined') {
        gsap.to(button, {
            scale: 0.95,
            duration: 0.1,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut"
        });
    }
}

// Display error
const displayError = (message) => {
    const errorDetails = document.getElementById('error-details');
    if (errorDetails) errorDetails.textContent = message;
    errorMessage.classList.add('show');

    if (window.gsap) {
        gsap.fromTo(errorMessage, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.5)' });
    }

    loadingSpinner.classList.remove('show');
    loginButton.classList.remove('hidden');
};

// Hide error
const hideError = () => {
    errorMessage.classList.remove('show');
};

// Google login handler
loginButton.addEventListener('click', async () => {
    buttonPressEffect(loginButton);
    hideError();
    loginButton.classList.add('hidden');
    loadingSpinner.classList.add('show');

    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        console.log("Login successful:", user.email);

    } catch (error) {
        console.error("Login error:", error);

        let userFriendlyMessage = "Authentication failed. Please try again.";

        switch (error.code) {
            case 'auth/popup-closed-by-user':
                userFriendlyMessage = "Login window closed. Please try again.";
                break;
            case 'auth/cancelled-popup-request':
                userFriendlyMessage = "Login request cancelled.";
                break;
            case 'auth/unauthorized-domain':
                userFriendlyMessage = "Unauthorized domain for login.";
                break;
            case 'auth/network-request-failed':
                userFriendlyMessage = "Network error. Check your connection.";
                break;
        }

        displayError(userFriendlyMessage);
    }
});

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    loginButton.classList.add('hidden');
    loadingSpinner.classList.add('show');
    checkAuthStatus(user);
});

// Add keyboard shortcut for login (Enter key)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !loadingSpinner.classList.contains('hidden')) {
        loginButton.click();
    }
});

// Check for redirect warning messages (e.g. guest trying to access discuss.html)
window.addEventListener('DOMContentLoaded', () => {
    const msg = sessionStorage.getItem('discuss_redirect_msg');
    if (msg) {
        displayError(msg);
        sessionStorage.removeItem('discuss_redirect_msg');
    }
});