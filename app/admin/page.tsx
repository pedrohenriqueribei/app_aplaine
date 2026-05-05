'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Church, ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      window.location.href = '/'; 
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos. Verifique suas credenciais.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Ocorreu um erro ao tentar entrar. Verifique sua conexão.');
      }
      console.error("Auth Error:", err.code);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-church-cream font-roboto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="p-4 bg-white shadow-xl rounded-full mb-6 border border-church-primary/20">
            <Church className="w-10 h-10 text-church-primary" />
          </div>
          <h1 className="text-church-dark text-2xl font-bold uppercase tracking-tighter text-center">Gestão Aplaine</h1>
          <div className="h-1 w-12 bg-church-primary mt-2" />
        </div>

        <Card className="border-0 bg-white text-church-dark rounded-none shadow-2xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-church-primary via-church-dark to-church-primary" />
          <CardHeader className="pt-8 text-center">
            <CardTitle className="text-xl font-bold uppercase tracking-tight">Login Administrativo</CardTitle>
            <CardDescription className="text-zinc-400 uppercase text-[10px] font-bold tracking-[0.2em] mt-1">
              Acesso restrito à diretoria e líderes
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold tracking-widest text-zinc-400 ml-1">E-mail de Acesso</Label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  placeholder="admin@apaine.com"
                  className="bg-zinc-50 border-zinc-100 rounded-none focus:border-church-primary h-12 shadow-sm italic text-sm" 
                />
              </div>
              <div className="space-y-2">
                <Label className="uppercase text-[10px] font-bold tracking-widest text-zinc-400 ml-1">Senha Privada</Label>
                <Input 
                  type="password" 
                  value={pass} 
                  onChange={e => setPass(e.target.value)} 
                  required 
                  className="bg-zinc-50 border-zinc-100 rounded-none focus:border-church-primary h-12 shadow-sm" 
                />
              </div>
              {error && (
                <motion.p 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="text-red-500 text-[10px] font-bold uppercase tracking-tight bg-red-50 p-2 border-l-2 border-red-500"
                >
                  {error}
                </motion.p>
              )}
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-church-dark text-church-primary hover:bg-church-dark/90 font-bold uppercase rounded-none h-14 mt-2 transition-all shadow-lg shadow-church-dark/10"
              >
                {loading ? 'Validando...' : 'Iniciar Sessão'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-zinc-50 border-t border-zinc-100 p-4">
            <Link href="/" className="w-full">
              <Button variant="ghost" className="w-full text-zinc-400 uppercase text-[10px] font-bold hover:text-church-dark tracking-widest">
                <ChevronLeft className="w-3 h-3 mr-2" /> Retornar ao site público
              </Button>
            </Link>
          </CardFooter>
        </Card>
        
        <div className="flex justify-center mt-12 gap-6 opacity-30">
          <div className="h-px bg-zinc-300 flex-1 my-auto" />
          <Church className="w-4 h-4 text-church-dark" />
          <div className="h-px bg-zinc-300 flex-1 my-auto" />
        </div>
      </motion.div>
    </main>
  );
}
