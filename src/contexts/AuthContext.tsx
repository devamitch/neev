import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: 'admin' | 'steward' | 'member' | null;
  familyId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userRole: null,
  familyId: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'steward' | 'member' | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Check if user exists in Firestore
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role);
            setFamilyId(userData.familyId || null);
          } else {
            // Create new user document
            // Defaulting to member, but if it's the first user or specific email, could be admin
            // For now, let's make them an admin if they are amit98ch@gmail.com
            const role = currentUser.email === 'amit98ch@gmail.com' ? 'admin' : 'member';
            
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              role: role,
              createdAt: serverTimestamp(),
            });
            
            setUserRole(role);
          }
        } catch (error) {
          console.error("Error fetching/creating user data:", error);
        }
      } else {
        setUserRole(null);
        setFamilyId(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userRole, familyId }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
