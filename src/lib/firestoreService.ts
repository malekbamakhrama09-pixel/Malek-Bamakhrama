import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { ResumeData } from '../types';

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const user = auth.currentUser;
  
  const errorInfo: FirestoreErrorInfo = {
    error: error.message || 'Unknown Firestore error',
    operationType,
    path,
    authInfo: {
      userId: user?.uid || 'anonymous',
      email: user?.email || '',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || true,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };

  if (error.code === 'permission-denied') {
    throw new Error(JSON.stringify(errorInfo));
  }
  
  throw error;
}

export const saveUserToFirestore = async (user: any) => {
  if (!user) return;
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    try {
      await setDoc(userRef, {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName,
        isPro: false,
        downloadCredits: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, 'create', `users/${user.uid}`);
    }
  }
};

export const saveResumeToFirestore = async (resume: ResumeData): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const resumeId = resume.id || doc(collection(db, 'resumes')).id;
  const resumeRef = doc(db, 'resumes', resumeId);

  const resumePayload = {
    ...resume,
    id: resumeId,
    userId: user.uid,
    updatedAt: serverTimestamp(),
    createdAt: resume.createdAt ? Timestamp.fromDate(new Date(resume.createdAt)) : serverTimestamp()
  };

  try {
    await setDoc(resumeRef, resumePayload);
    return resumeId;
  } catch (e) {
    handleFirestoreError(e, 'write', `resumes/${resumeId}`);
  }
};

export const getResumesFromFirestore = async (): Promise<ResumeData[]> => {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'resumes'), 
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        } as ResumeData;
    });
  } catch (e) {
    handleFirestoreError(e, 'list', 'resumes');
  }
};

export const deleteResumeFromFirestore = async (resumeId: string) => {
  try {
    await deleteDoc(doc(db, 'resumes', resumeId));
  } catch (e) {
    handleFirestoreError(e, 'delete', `resumes/${resumeId}`);
  }
};
