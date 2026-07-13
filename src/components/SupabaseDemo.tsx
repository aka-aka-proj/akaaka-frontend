import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function SupabaseDemo() {
  const [user, setUser] = useState<any>(null);
  const [todos, setTodos] = useState<any[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser((data as any)?.user ?? null);
      } catch (e) {
        // ignore
      }
      await fetchTodos();
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session as any)?.user ?? null);
    });
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  async function fetchTodos() {
    const { data, error } = await supabase.from('todos').select('*').order('id', { ascending: true });
    if (error) { setMsg(error.message); return; }
    setTodos(data ?? []);
  }

  async function addTodo() {
    if (!newTodo) return;
    setLoading(true);
    const { error } = await supabase.from('todos').insert([{ task: newTodo }]);
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    setNewTodo('');
    await fetchTodos();
  }

  async function signUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    setMsg('註冊成功，請檢查電子郵件以完成驗證（如啟用）。');
  }

  async function signIn() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    setMsg('登入成功');
    setUser((data as any).user ?? null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setMsg('已登出');
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Supabase 範例（Auth + Todos）</h2>
      <div style={{ marginBottom: 12 }}>
        <strong>目前使用者：</strong> {user ? user.email : '未登入'}
      </div>

      <div style={{ marginBottom: 12 }}>
        <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={signUp} disabled={loading}>註冊</button>
        <button onClick={signIn} disabled={loading}>登入</button>
        <button onClick={signOut}>登出</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input placeholder="新的 todo" value={newTodo} onChange={e => setNewTodo(e.target.value)} />
        <button onClick={addTodo} disabled={loading}>新增</button>
        <button onClick={fetchTodos}>重新整理</button>
      </div>

      {msg && <div style={{ color: 'crimson', marginBottom: 12 }}>{msg}</div>}

      <ul>
        {todos.map((t: any) => (
          <li key={t.id}>{t.task}</li>
        ))}
      </ul>
    </div>
  );
}
