import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { subscribeClients } from "../services/clients";
import { subscribeProjects } from "../services/projects";
import { subscribeExpenses, subscribeRecurringTemplates } from "../services/expenses";
import { subscribeIncome } from "../services/financial";
const useSub=(subscribe)=>{const {user,isConfigured,preview}=useAuth();const [items,setItems]=useState([]),[error,setError]=useState(""),[loading,setLoading]=useState(Boolean(user&&isConfigured&&!preview));useEffect(()=>{if(!user||!isConfigured||preview)return;return subscribe(user.uid,x=>{setItems(x);setLoading(false);},()=>{setError("A dashboard source could not be loaded.");setLoading(false);});},[user,isConfigured,preview,subscribe]);return {items,error,loading};};
export function useDashboardData(){const clients=useSub(subscribeClients),projects=useSub(subscribeProjects),expenses=useSub(subscribeExpenses),income=useSub(subscribeIncome),templates=useSub(subscribeRecurringTemplates);return {clients,projects,expenses,income,templates,loading:[clients,projects,expenses,income,templates].some(x=>x.loading),errors:[clients,projects,expenses,income,templates].filter(x=>x.error).map(x=>x.error)};}
