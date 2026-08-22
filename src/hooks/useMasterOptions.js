import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/useAuth";
export function useMasterOptions(group, activeOnly = true) {
  const { user, isConfigured, preview } = useAuth();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(
    Boolean(user && isConfigured && !preview),
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user || !isConfigured || preview) return undefined;
    const constraints = [where("group", "==", group), orderBy("sortOrder")];
    if (activeOnly) constraints.unshift(where("isActive", "==", true));
    return onSnapshot(
      query(collection(db, "masterOptions"), ...constraints),
      (snap) => {
        setOptions(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      () => {
        setError("Options could not be loaded.");
        setLoading(false);
      },
    );
  }, [group, activeOnly, user, isConfigured, preview]);
  return { options, loading, error };
}
