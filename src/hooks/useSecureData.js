import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { subscribeCredentials } from "../services/credentials";
import { subscribeProjectDocuments } from "../services/documents";
export function useCredentials() { const { user, isConfigured, preview } = useAuth(); const [items, setItems] = useState([]); useEffect(() => (!user || !isConfigured || preview ? undefined : subscribeCredentials(user.uid, setItems, () => setItems([]))), [user, isConfigured, preview]); return { items }; }
export function useProjectDocuments(projectId) { const { user, isConfigured, preview } = useAuth(); const [items, setItems] = useState([]); useEffect(() => (!user || !projectId || !isConfigured || preview ? undefined : subscribeProjectDocuments(user.uid, projectId, setItems, () => setItems([]))), [user, projectId, isConfigured, preview]); return { items }; }
