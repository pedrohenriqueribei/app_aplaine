'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, Calendar, Users, MessageSquare, ChevronRight, Plus, Church, 
  LogOut, Search, Play, ExternalLink, Trash2, Clock, MapPin, Send
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useOrganization } from '@/hooks/use-organization';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { collection, addDoc, setDoc, doc, query, where, getDocs, serverTimestamp, onSnapshot, orderBy, limit, deleteDoc } from 'firebase/firestore';

type TabType = 'dashboard' | 'scales' | 'repertoire' | 'team' | 'chat';

export default function Home() {
  const { user, profile, isAdmin: isSuperAdmin, signIn, signInEmail, logOut, loading: authLoading } = useAuth();
  const { currentOrg, userRole, loading: orgLoading } = useOrganization();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    name: '', phone: '', responsible: '',
    cep: '', street: '', neighborhood: '', city: '', state: '', number: '',
    ministryName: '', ministryAcronym: '', ministryDesc: '', ministryLeader: ''
  });
  const [orgs, setOrgs] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newSong, setNewSong] = useState({ title: '', artist: '', bpm: '', key: '', url: '' });
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    if (user && !profile?.currentOrganizationId) {
      const q = isSuperAdmin 
        ? collection(db, 'organizations') 
        : query(collection(db, 'organizations'), where('ownerId', '==', user.uid));
      
      getDocs(q).then(snap => setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    if (currentOrg) {
      const unsubS = onSnapshot(query(collection(db, 'organizations', currentOrg.id, 'songs'), orderBy('title')), snap => setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubE = onSnapshot(query(collection(db, 'organizations', currentOrg.id, 'events'), orderBy('date', 'asc')), snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubM = onSnapshot(collection(db, 'organizations', currentOrg.id, 'members'), snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubMs = onSnapshot(query(collection(db, 'organizations', currentOrg.id, 'messages'), orderBy('timestamp', 'desc'), limit(50)), snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse()));
      return () => { unsubS(); unsubE(); unsubM(); unsubMs(); };
    }
  }, [user, profile, currentOrg, isSuperAdmin]);

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setNewOrgData(prev => ({
          ...prev,
          cep: cleanCep,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const orgRef = await addDoc(collection(db, 'organizations'), { 
        name: newOrgData.name,
        phone: newOrgData.phone,
        responsible: newOrgData.responsible,
        address: {
          cep: newOrgData.cep,
          street: newOrgData.street,
          neighborhood: newOrgData.neighborhood,
          city: newOrgData.city,
          state: newOrgData.state,
          number: newOrgData.number
        },
        ministry: {
          name: newOrgData.ministryName,
          acronym: newOrgData.ministryAcronym,
          description: newOrgData.ministryDesc,
          leaderName: newOrgData.ministryLeader
        },
        slug: newOrgData.name.toLowerCase().replace(/\s+/g, '-'), 
        ownerId: user.uid, 
        createdAt: serverTimestamp() 
      });
      await setDoc(doc(db, 'organizations', orgRef.id, 'members', user.uid), { userId: user.uid, role: 'ADMIN', status: 'ACTIVE', joinedAt: serverTimestamp() });
      await setDoc(doc(db, 'users', user.uid), { currentOrganizationId: orgRef.id }, { merge: true });
      setIsCreatingOrg(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar organização. Verifique suas permissões.');
    }
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    await addDoc(collection(db, 'organizations', currentOrg.id, 'songs'), { ...newSong, bpm: Number(newSong.bpm), organizationId: currentOrg.id, createdAt: serverTimestamp() });
    setNewSong({ title: '', artist: '', bpm: '', key: '', url: '' }); setIsAddingSong(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !user || !newMessage.trim()) return;
    await addDoc(collection(db, 'organizations', currentOrg.id, 'messages'), { senderId: user.uid, senderName: user.displayName, senderPhoto: user.photoURL, content: newMessage, timestamp: serverTimestamp(), organizationId: currentOrg.id });
    setNewMessage('');
  };

  if (authLoading || orgLoading) return <LoadingScreen />;
  if (!user) return showAdminLogin ? <AdminLogin signInEmail={signInEmail} back={() => setShowAdminLogin(false)} /> : <LandingPage signIn={signIn} onAdminClick={() => setShowAdminLogin(true)} />;
  
  if (!currentOrg) return (
    <OrgSelection 
      user={user} 
      orgs={orgs} 
      isCreating={isCreatingOrg} 
      setIsCreating={setIsCreatingOrg} 
      newOrgData={newOrgData} 
      setNewOrgData={setNewOrgData} 
      handleCreate={handleCreateOrg} 
      handleCepLookup={handleCepLookup}
      selectOrg={(id:string) => setDoc(doc(db, 'users', user.uid), { currentOrganizationId: id }, { merge: true })} 
      logOut={logOut} 
      isSuperAdmin={isSuperAdmin}
    />
  );

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex font-sans">
      <aside className="w-64 border-r border-zinc-200 p-6 flex flex-col gap-8 bg-white fixed h-full z-10">
        <div className="flex items-center gap-2 px-2"><Church className="text-primary w-6 h-6" /><h1 className="text-xl font-display font-bold">Apaine</h1></div>
        <nav className="flex-1 flex flex-col gap-1">
            <SidebarItem icon={<Calendar className="w-4 h-4"/>} label="Escalas" active={activeTab === 'scales'} onClick={() => setActiveTab('scales')} />
            <SidebarItem icon={<Music className="w-4 h-4"/>} label="Repertório" active={activeTab === 'repertoire'} onClick={() => setActiveTab('repertoire')} />
            <SidebarItem icon={<Users className="w-4 h-4"/>} label="Equipe" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
            <SidebarItem icon={<MessageSquare className="w-4 h-4"/>} label="Comunicação" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
            <SidebarItem icon={<ChevronRight className="w-4 h-4 rotate-180"/>} label="Início" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        </nav>
        <div className="pt-6 border-t mt-auto">
            <div className="flex items-center gap-3 px-2 mb-4">
                <Avatar className="w-8 h-8"><AvatarImage src={user.photoURL || ''} /><AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback></Avatar>
                <div className="overflow-hidden"><p className="text-sm font-medium truncate">{user.displayName}</p><p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{userRole}</p></div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50" onClick={logOut}><LogOut className="mr-2 w-4 h-4" /> Sair</Button>
        </div>
      </aside>

      <section className="flex-1 ml-64 p-8 overflow-auto min-h-screen">
        <header className="flex justify-between items-center mb-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="text-3xl font-display font-bold">{activeTab === 'dashboard' ? 'Início' : activeTab === 'scales' ? 'Escalas' : activeTab === 'repertoire' ? 'Repertório' : activeTab === 'team' ? 'Equipe' : 'Comunicação'}</h2>
                <p className="text-zinc-500">{currentOrg.name}</p>
            </motion.div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setDoc(doc(db, 'users', user.uid), { currentOrganizationId: '' }, { merge: true })}>Trocar Ministério</Button>
                {activeTab === 'repertoire' && (
                  <Dialog open={isAddingSong} onOpenChange={setIsAddingSong}>
                    <DialogTrigger render={<Button size="sm"><Plus className="mr-2 w-4 h-4" /> Nova Música</Button>} />
                    <DialogContent>
                      <DialogHeader><DialogTitle>Adicionar Música</DialogTitle></DialogHeader>
                      <form onSubmit={handleAddSong} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Título</Label><Input value={newSong.title} onChange={e => setNewSong({...newSong, title: e.target.value})} required /></div><div className="space-y-2"><Label>Artista</Label><Input value={newSong.artist} onChange={e => setNewSong({...newSong, artist: e.target.value})} /></div></div>
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>BPM</Label><Input type="number" value={newSong.bpm} onChange={e => setNewSong({...newSong, bpm: e.target.value})} /></div><div className="space-y-2"><Label>Tom</Label><Input value={newSong.key} onChange={e => setNewSong({...newSong, key: e.target.value})} placeholder="Ex: C#" /></div></div>
                        <div className="space-y-2"><Label>Link de Áudio / Vídeo</Label><Input value={newSong.url} onChange={e => setNewSong({...newSong, url: e.target.value})} placeholder="YouTube, Spotify, Drive..." /></div>
                        <Button type="submit" className="w-full">Salvar Música</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
            </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Próxima Escala</CardTitle><Calendar className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent>{events.length > 0 ? (<><div className="text-2xl font-bold">{events[0].title}</div><p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mt-1">{new Date(events[0].date.toDate()).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p></>) : (<p className="text-zinc-500 text-sm">Nenhuma escala agendada.</p>)}</CardContent><CardFooter><Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('scales')}>Ver Escalas</Button></CardFooter></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Repertório</CardTitle><Music className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{songs.length} Músicas</div><p className="text-xs text-muted-foreground">Adicionadas ao catálogo</p><div className="mt-4 space-y-2">{songs.slice(0, 3).map(song => (<div key={song.id} className="text-xs flex justify-between border-l-2 border-primary/30 pl-2"><span className="font-semibold">{song.title}</span><span className="text-zinc-400">{song.artist}</span></div>))}</div></CardContent><CardFooter><Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveTab('repertoire')}>Ver Repertório</Button></CardFooter></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Chat do Ministério</CardTitle><MessageSquare className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent className="h-32 flex items-center justify-center text-center"><div><p className="text-sm text-zinc-500 mb-2">Comunique-se com a equipe em tempo real.</p><Button size="sm" onClick={() => setActiveTab('chat')}>Abrir Chat</Button></div></CardContent></Card>
            </motion.div>
          )}

          {activeTab === 'repertoire' && (
            <motion.div key="repertoire" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <Table><TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Artista</TableHead><TableHead>BPM/Tom</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{songs.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center py-12 text-zinc-400 font-medium">Nenhuma música cadastrada ainda.</TableCell></TableRow>) : (songs.map(song => (<TableRow key={song.id}><TableCell className="font-semibold">{song.title}</TableCell><TableCell>{song.artist || '-'}</TableCell><TableCell><div className="flex gap-2">{song.bpm && <Badge variant="outline">{song.bpm} BPM</Badge>}{song.key && <Badge variant="secondary">{song.key}</Badge>}</div></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{song.url && (<Button variant="ghost" size="icon" render={<a href={song.url} target="_blank" rel="noopener noreferrer" />}><Play className="w-4 h-4" /></Button>)}<Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'organizations', currentOrg.id, 'songs', song.id))} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button></div></TableCell></TableRow>)))}</TableBody></Table>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-[calc(100vh-200px)] bg-white border rounded-xl shadow-sm overflow-hidden">
              <ScrollArea className="flex-1 p-6"><div className="space-y-6">{messages.map((msg) => { const isMe = msg.senderId === user.uid; return (<div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}><Avatar className="w-8 h-8"><AvatarImage src={msg.senderPhoto} /><AvatarFallback>{msg.senderName?.charAt(0)}</AvatarFallback></Avatar><div className={`space-y-1 max-w-[70%] ${isMe ? 'items-end flex flex-col' : ''}`}><div className="flex items-center gap-2">{!isMe && <span className="text-xs font-bold">{msg.senderName}</span>}<span className="text-[10px] text-zinc-400">{msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-primary text-white' : 'bg-zinc-100 border'}`}>{msg.content}</div></div></div>);})}</div></ScrollArea>
              <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2"><Input placeholder="Escreva uma mensagem..." value={newMessage} onChange={e => setNewMessage(e.target.value)} className="flex-1" /><Button type="submit" size="icon"><Send className="w-4 h-4" /></Button></form>
            </motion.div>
          )}

          {activeTab === 'scales' && (
            <motion.div key="scales" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
               <div className="flex justify-end">
                  <Dialog><DialogTrigger render={<Button size="sm"><Plus className="mr-2 w-4 h-4" /> Nova Escala</Button>} /><DialogContent><DialogHeader><DialogTitle>Agendar Escala / Ensaio</DialogTitle></DialogHeader><form onSubmit={async (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); await addDoc(collection(db, 'organizations', currentOrg.id, 'events'), { title: data.get('title'), type: data.get('type'), date: new Date(data.get('date') + 'T' + data.get('time')), description: data.get('description'), organizationId: currentOrg.id, createdAt: serverTimestamp() }); alert('Evento criado!'); }} className="space-y-4 py-4"><div className="space-y-2"><Label>Título</Label><Input name="title" required /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Tipo</Label><Select name="type" defaultValue="SERVICE"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SERVICE">Culto</SelectItem><SelectItem value="REHEARSAL">Ensaio</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Info</Label><Input placeholder="..." disabled /></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Data</Label><Input name="date" type="date" required /></div><div className="space-y-2"><Label>Hora</Label><Input name="time" type="time" required /></div></div><Button type="submit" className="w-full">Agendar</Button></form></DialogContent></Dialog>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{events.length === 0 ? (<Card className="col-span-full py-12 flex flex-col items-center justify-center border-dashed border-2"><Calendar className="w-12 h-12 text-zinc-200 mb-4" /><p className="text-zinc-500 font-medium">Nenhum evento agendado.</p></Card>) : (events.map(event => (<Card key={event.id} className="overflow-hidden border-zinc-200 hover:shadow-md transition-shadow"><div className={`h-2 ${event.type === 'SERVICE' ? 'bg-primary' : 'bg-orange-400'}`} /><CardHeader><div className="flex justify-between items-start"><Badge variant="outline">{event.type === 'SERVICE' ? 'Culto' : 'Ensaio'}</Badge><span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center"><Clock className="w-3 h-3 mr-1" />{new Date(event.date.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><CardTitle className="mt-2">{event.title}</CardTitle><CardDescription>{new Date(event.date.toDate()).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</CardDescription></CardHeader><CardContent><p className="text-sm text-zinc-600 line-clamp-2">{event.description || 'Sem descrição.'}</p></CardContent><CardFooter className="bg-zinc-50/50 justify-between"><div className="flex -space-x-2"><MemberAvatar initials="?" color="bg-zinc-300" /></div><Button variant="ghost" size="sm">Ver mais</Button></CardFooter></Card>)))}</div>
            </motion.div>
          )}

          {activeTab === 'team' && (
            <motion.div key="team" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{members.map(member => (<Card key={member.id} className="overflow-hidden"><CardHeader className="p-4 items-center gap-2"><Avatar className="w-12 h-12"><AvatarImage src="" /><AvatarFallback>{member.role?.charAt(0)}</AvatarFallback></Avatar><CardTitle className="text-sm">{member.userId === user.uid ? 'Você' : member.userId.slice(0, 8)}</CardTitle><Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'}>{member.role}</Badge></CardHeader></Card>))}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function LoadingScreen() { return (<div className="flex flex-col items-center justify-center min-h-screen gap-4"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Music className="w-10 h-10 text-primary" /></motion.div><p className="text-zinc-400 font-display animate-pulse">Sintonizando Apaine...</p></div>); }
function LandingPage({ signIn, onAdminClick }: { signIn: () => void, onAdminClick: () => void }) { return (<main className="flex flex-col min-h-screen items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black text-white"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl px-4"><div className="flex justify-center mb-6"><div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 backdrop-blur-sm"><Church className="w-12 h-12 text-primary" /></div></div><h1 className="text-7xl font-display font-bold tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">APAINE</h1><p className="text-xl text-zinc-400 mb-8 leading-relaxed max-w-lg mx-auto">Simplifique a gestão do seu ministério de louvor. Escalas, repertório e comunicação em um só lugar.</p><div className="flex flex-col sm:flex-row gap-4 justify-center"><Button size="lg" onClick={signIn} className="rounded-full px-8 text-lg font-medium group bg-white text-black hover:bg-zinc-200">Começar com Google<ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" /></Button><Button size="lg" variant="outline" onClick={onAdminClick} className="rounded-full px-8 border-zinc-800 text-white hover:bg-zinc-800">Login Admin</Button></div></motion.div></main>); }

function AdminLogin({ signInEmail, back }: any) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInEmail(email, pass);
    } catch (err: any) {
      setError('Credenciais inválidas ou acesso negado.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-zinc-950">
      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900 text-white">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription className="text-zinc-500">Acesso restrito ao Super Admin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-zinc-800 border-zinc-700" /></div>
            <div className="space-y-2"><Label>Senha</Label><Input type="password" value={pass} onChange={e => setPass(e.target.value)} required className="bg-zinc-800 border-zinc-700" /></div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </CardContent>
        <CardFooter><Button variant="ghost" className="w-full text-zinc-400" onClick={back}>Voltar</Button></CardFooter>
      </Card>
    </main>
  );
}

function OrgSelection({ user, orgs, isCreating, setIsCreating, newOrgData, setNewOrgData, handleCreate, handleCepLookup, selectOrg, logOut, isSuperAdmin }: any) { 
  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <Card className="w-full max-w-2xl border-zinc-200 shadow-xl rounded-2xl overflow-hidden">
        <div className="bg-zinc-900 text-white p-8 flex justify-between items-center">
          <div>
            <Church className="w-8 h-8 text-primary mb-2" />
            <h2 className="text-2xl font-display font-bold">Painel {isSuperAdmin ? 'Administrativo' : 'do Líder'}</h2>
            <p className="text-zinc-400 text-sm">Selecione ou cadastre uma nova instância.</p>
          </div>
          {isSuperAdmin && <Badge className="bg-primary text-black">SUPER ADMIN</Badge>}
        </div>
        <CardContent className="p-6 pt-8 space-y-6">
          <AnimatePresence mode="popLayout">
            {orgs.length > 0 && !isCreating && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {orgs.map((org: any) => (
                  <Button key={org.id} variant="outline" className="w-full justify-between h-20 text-lg rounded-xl hover:border-primary hover:bg-primary/5 transition-all group p-4" onClick={() => selectOrg(org.id)}>
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="truncate w-full text-left">{org.name}</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-tighter truncate w-full">{org.ministry?.acronym || 'SEM SIGLA'}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Button>
                ))}
              </motion.div>
            )}
            
            {isCreating ? (
              <motion.form key="form" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-bold border-b pb-2 flex items-center gap-2"><Church className="w-4 h-4"/> Dados da Igreja</h3>
                    <div className="space-y-2"><Label>Nome da Igreja</Label><Input value={newOrgData.name} onChange={e => setNewOrgData({...newOrgData, name: e.target.value})} required className="rounded-xl" /></div>
                    <div className="space-y-2"><Label>Telefone</Label><Input value={newOrgData.phone} onChange={e => setNewOrgData({...newOrgData, phone: e.target.value})} className="rounded-xl" /></div>
                    <div className="space-y-2"><Label>Responsável</Label><Input value={newOrgData.responsible} onChange={e => setNewOrgData({...newOrgData, responsible: e.target.value})} className="rounded-xl" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2"><Label>CEP</Label><Input value={newOrgData.cep} onBlur={(e) => handleCepLookup(e.target.value)} onChange={e => setNewOrgData({...newOrgData, cep: e.target.value})} placeholder="00000-000" className="rounded-xl" /></div>
                      <div className="space-y-2"><Label>Nº</Label><Input value={newOrgData.number} onChange={e => setNewOrgData({...newOrgData, number: e.target.value})} className="rounded-xl" /></div>
                    </div>
                    <div className="space-y-2"><Label>Logradouro</Label><Input value={newOrgData.street} readOnly className="bg-zinc-50 rounded-xl" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2"><Label>Bairro</Label><Input value={newOrgData.neighborhood} readOnly className="bg-zinc-50 rounded-xl" /></div>
                      <div className="space-y-2"><Label>Cidade/UF</Label><Input value={`${newOrgData.city} - ${newOrgData.state}`} readOnly className="bg-zinc-50 rounded-xl" /></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold border-b pb-2 flex items-center gap-2"><Music className="w-4 h-4"/> Ministério de Louvor</h3>
                    <div className="space-y-2"><Label>Nome do Ministério</Label><Input value={newOrgData.ministryName} onChange={e => setNewOrgData({...newOrgData, ministryName: e.target.value})} required className="rounded-xl" /></div>
                    <div className="space-y-2"><Label>Sigla</Label><Input value={newOrgData.ministryAcronym} onChange={e => setNewOrgData({...newOrgData, ministryAcronym: e.target.value})} placeholder="Ex: MLD" className="rounded-xl" /></div>
                    <div className="space-y-2"><Label>Líder do Ministério</Label><Input value={newOrgData.ministryLeader} onChange={e => setNewOrgData({...newOrgData, ministryLeader: e.target.value})} className="rounded-xl" /></div>
                    <div className="space-y-2"><Label>Descrição</Label><Input value={newOrgData.ministryDesc} onChange={e => setNewOrgData({...newOrgData, ministryDesc: e.target.value})} className="rounded-xl" /></div>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 h-12 rounded-xl">Registrar Instância</Button>
                  <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} className="h-12 rounded-xl">Cancelar</Button>
                </div>
              </motion.form>
            ) : (
              (isSuperAdmin || orgs.length === 0) && (
                <Button variant="ghost" className="w-full border-dashed border-2 h-16 rounded-xl border-zinc-300 hover:border-primary hover:bg-zinc-50" onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2" /> Cadastrar nova Igreja/Ministério
                </Button>
              )
            )}
          </AnimatePresence>
        </CardContent>
        <CardFooter className="bg-zinc-50 p-4 flex justify-center border-t">
          <Button variant="ghost" size="sm" onClick={logOut} className="text-zinc-500 hover:text-black">Sair da conta</Button>
        </CardFooter>
      </Card>
    </main>
  ); 
}
function SidebarItem({ icon, label, active = false, onClick }: any) { return (<Button variant={active ? "secondary" : "ghost"} onClick={onClick} className={`w-full justify-start font-medium h-12 px-4 rounded-xl transition-all ${active ? 'bg-zinc-100 text-black translate-x-1' : 'text-zinc-500'}`}><span className={`mr-3 ${active ? 'text-primary' : 'text-zinc-400'}`}>{icon}</span>{label}</Button>); }
function MemberAvatar({ initials, color }: { initials: string, color: string }) { return (<div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold ${color}`}>{initials}</div>); }
