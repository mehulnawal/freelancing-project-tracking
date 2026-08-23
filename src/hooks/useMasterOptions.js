import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import { rtdb } from '../config/firebase'
import { useAuth } from '../context/useAuth'
export function useMasterOptions(group,activeOnly=true){const {user,isConfigured,preview}=useAuth();const [options,setOptions]=useState([]);const [loading,setLoading]=useState(Boolean(user&&isConfigured&&!preview));const [error,setError]=useState('');useEffect(()=>{if(!user||!isConfigured||preview||!rtdb)return undefined;return onValue(ref(rtdb,`users/${user.uid}/masterOptions`),snap=>{setOptions(Object.entries(snap.val()||{}).map(([id,x])=>({id,...x})).filter(x=>x.group===group&&(!activeOnly||x.isActive!==false)).sort((a,b)=>(a.sortOrder??999999)-(b.sortOrder??999999)||String(a.label).localeCompare(String(b.label))));setLoading(false);setError('')},()=>{setError('Options could not be loaded.');setLoading(false)})},[group,activeOnly,user,isConfigured,preview]);return{options,loading,error}}
