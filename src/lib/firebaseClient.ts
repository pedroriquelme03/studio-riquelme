import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogleAndGetIdToken(): Promise<{ idToken: string; cred: UserCredential }> {
	const cred = await signInWithPopup(auth, provider);
	const idToken = await cred.user.getIdToken();
	return { idToken, cred };
}

export { app, auth };


