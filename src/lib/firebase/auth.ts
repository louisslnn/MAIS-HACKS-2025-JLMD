/**
 * Firebase Authentication utilities
 */

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  updatePassword as firebaseUpdatePassword,
  updateEmail as firebaseUpdateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from './client';

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(userCredential.user);
  return userCredential.user;
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, displayName: string): Promise<User> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await createUserDocument(userCredential.user, displayName);
  return userCredential.user;
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  await ensureUserDocument(userCredential.user);
  return userCredential.user;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Create user document in Firestore with default values
 */
async function createUserDocument(user: User, displayName?: string): Promise<void> {
  const userRef = doc(firestore, 'users', user.uid);
  
  await setDoc(userRef, {
    uid: user.uid,
    displayName: displayName || user.displayName || 'Anonymous',
    email: user.email || '',
    rating: 1000, // Chess.com-style starting rating
    stats: {
      wins: 0,
      losses: 0,
      draws: 0,
      matchesPlayed: 0,
      correctAnswers: 0,
      totalTimeMs: 0,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Ensure user document exists, create if missing
 */
async function ensureUserDocument(user: User): Promise<void> {
  const userRef = doc(firestore, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await createUserDocument(user);
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Update user profile (display name)
 */
export async function updateUserProfile(displayName: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user signed in');
  
  // Update Firebase Auth profile
  await firebaseUpdateProfile(user, { displayName });
  
  // Update Firestore user document
  const userRef = doc(firestore, 'users', user.uid);
  await updateDoc(userRef, {
    displayName,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update user email
 */
export async function updateUserEmail(newEmail: string, currentPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No user signed in');
  
  // Reauthenticate first
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  
  // Update email
  await firebaseUpdateEmail(user, newEmail);
  
  // Update Firestore user document
  const userRef = doc(firestore, 'users', user.uid);
  await updateDoc(userRef, {
    email: newEmail,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update user password
 */
export async function updateUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No user signed in');
  
  // Reauthenticate first
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  
  // Update password
  await firebaseUpdatePassword(user, newPassword);
}

