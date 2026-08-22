/* eslint-disable preserve-caught-error */
import { browserLocalPersistence, browserSessionPersistence, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../config/firebase'

const generic = 'Invalid email, user ID, or password.'
const resolveEmail = (identifier) => { const value = identifier.trim(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value; if (value.toLowerCase() === (import.meta.env.VITE_ADMIN_LOGIN_ID || '').trim().toLowerCase()) return import.meta.env.VITE_ADMIN_EMAIL; return null }
const ready = () => { if (!isFirebaseConfigured) throw new Error('Firebase configuration is required.') }
export async function login(identifier, password, remember) { ready(); const email = resolveEmail(identifier); if (!email) throw new Error(generic); try { await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence); return await signInWithEmailAndPassword(auth, email, password) } catch (error) { throw new Error(generic, { cause: error }) } }
export async function requestPasswordReset(identifier) { ready(); const email = resolveEmail(identifier); if (email) { try { await sendPasswordResetEmail(auth, email) } catch { /* intentionally generic */ } } }
export async function changePassword(currentPassword, newPassword) { ready(); try { const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword); await reauthenticateWithCredential(auth.currentUser, credential); await updatePassword(auth.currentUser, newPassword) } catch (error) { throw new Error(error.code === 'auth/requires-recent-login' ? 'Please sign in again before changing your password.' : 'We could not change your password. Check your current password and try again.') } }
export const logout = () => isFirebaseConfigured ? signOut(auth) : Promise.resolve()
