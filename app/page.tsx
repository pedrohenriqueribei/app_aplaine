'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
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
  const { user, profile, isAdmin: isSuperAdmin, signIn, logOut, loading: authLoading } = useAuth();
  const { currentOrg, userRole, loading: orgLoading } = useOrganization();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberData, setNewMemberData] = useState({ userId: '', role: 'MEMBER' });
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

  useEffect(() => {
    if (user?.email === 'pedrohenriqueribei@gmail.com' && !isSuperAdmin) {
      setDoc(doc(db, 'admins', user.uid), {
        name: 'Pedro Henrique',
        role: 'CEO',
        email: user.email,
        createdAt: serverTimestamp()
      }).catch(console.error);
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (user && !profile?.currentOrganizationId) {
      const q = isSuperAdmin 
        ? collection(db, 'organizations') 
        : query(collection(db, 'organizations'), where('ownerId', '==', user.uid));
      
      getDocs(q)
        .then(snap => setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
        .catch(err => console.error("Error fetching organizations:", err));
    }
    if (currentOrg) {
      const orgRef = doc(db, 'organizations', currentOrg.id);
      const unsubS = onSnapshot(query(collection(orgRef, 'songs'), orderBy('title')), {
        next: snap => setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        error: err => console.error("Songs listener error:", err)
      });
      const unsubE = onSnapshot(query(collection(orgRef, 'events'), orderBy('date', 'asc')), {
        next: snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        error: err => console.error("Events listener error:", err)
      });
      const unsubM = onSnapshot(collection(orgRef, 'members'), {
        next: snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        error: err => console.error("Members listener error:", err)
      });
      const unsubMs = onSnapshot(query(collection(orgRef, 'messages'), orderBy('timestamp', 'desc'), limit(50)), {
        next: snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse()),
        error: err => console.error("Messages listener error:", err)
      });
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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !newMemberData.userId.trim()) return;
    try {
      await setDoc(doc(db, 'organizations', currentOrg.id, 'members', newMemberData.userId.trim()), {
        userId: newMemberData.userId.trim(),
        role: newMemberData.role,
        status: 'ACTIVE',
        joinedAt: serverTimestamp()
      });
      setIsAddingMember(false);
      setNewMemberData({ userId: '', role: 'MEMBER' });
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar membro. Verifique se o ID do usuário está correto.');
    }
  };

  if (authLoading || orgLoading) return <LoadingScreen />;
  if (!user) return <LandingPage signIn={signIn} />;
  
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
    <main className="min-h-screen bg-church-cream flex font-roboto text-church-dark">
      <aside className="w-64 border-r border-zinc-200 p-6 flex flex-col gap-8 bg-white fixed h-full z-10">
        <div className="flex items-center gap-2 px-2">
          <Church className="text-church-dark w-6 h-6" />
          <h1 className="text-xl font-bold uppercase tracking-tight">Aplaine</h1>
        </div>
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
                <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                    <button 
                        className="text-[9px] text-zinc-400 hover:text-church-primary flex items-center gap-1 uppercase font-bold tracking-wider transition-colors"
                        onClick={() => { navigator.clipboard.writeText(user.uid); alert('Seu ID foi copiado!'); }}
                        title="Clique para copiar seu ID"
                    >
                        {user.uid.slice(0, 8)}... <Clock className="w-2 h-2" />
                    </button>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{userRole === 'ADMIN' ? 'Líder do Ministério' : userRole || 'Membro'}</p>
                </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50" onClick={logOut}><LogOut className="mr-2 w-4 h-4" /> Sair</Button>
        </div>
      </aside>

      <section className="flex-1 ml-64 p-8 overflow-auto min-h-screen">
        <header className="flex justify-between items-center mb-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="text-3xl font-bold uppercase tracking-tight">
                  {activeTab === 'dashboard' ? 'Início' : activeTab === 'scales' ? 'Escalas' : activeTab === 'repertoire' ? 'Repertório' : activeTab === 'team' ? 'Equipe' : 'Comunicação'}
                </h2>
                <p className="text-zinc-500 font-medium uppercase text-xs tracking-widest">{currentOrg.name}</p>
            </motion.div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-md border-church-dark/20 uppercase text-xs font-bold" onClick={() => setDoc(doc(db, 'users', user.uid), { currentOrganizationId: '' }, { merge: true })}>Trocar Ministério</Button>
                {activeTab === 'team' && (isSuperAdmin || userRole === 'ADMIN') && (
                  <Dialog open={isAddingMember} onOpenChange={setIsAddingMember}>
                    <DialogTrigger render={<Button size="sm" className="bg-church-dark text-church-primary hover:bg-church-dark/90 rounded-md uppercase text-xs font-bold"><Plus className="mr-2 w-4 h-4" /> Adicionar Líder/Membro</Button>} />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar à Equipe</DialogTitle>
                        <DialogDescription>Insira o ID do usuário para adicioná-lo a este ministério.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddMember} className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>ID do Usuário (UID)</Label>
                          <Input value={newMemberData.userId} onChange={e => setNewMemberData({...newMemberData, userId: e.target.value})} placeholder="Copie o UID do usuário" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Função / Cargo</Label>
                          <Select value={newMemberData.role} onValueChange={v => setNewMemberData({...newMemberData, role: v || 'MEMBER'})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">Líder do Ministério</SelectItem>
                              <SelectItem value="MEMBER">Membro da Equipe</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full bg-church-dark text-church-primary font-bold uppercase tracking-widest">Confirmar Adição</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
                {activeTab === 'repertoire' && (
                  <Dialog open={isAddingSong} onOpenChange={setIsAddingSong}>
                    <DialogTrigger render={<Button size="sm" className="bg-church-primary text-church-dark hover:bg-church-primary/90 rounded-md uppercase text-xs font-bold"><Plus className="mr-2 w-4 h-4" /> Nova Música</Button>} />
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
            <motion.div key="team" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 {members.map(member => (
                   <Card key={member.id} className="overflow-hidden group hover:shadow-lg transition-all border-zinc-200">
                     <CardHeader className="p-6 items-center gap-4">
                       <div className="relative">
                        <Avatar className="w-20 h-20 shadow-inner border-2 border-zinc-50">
                          <AvatarImage src="" />
                          <AvatarFallback className="bg-church-cream text-church-dark text-xl font-bold">{member.userId.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {member.role === 'ADMIN' && (
                          <div className="absolute -top-1 -right-1 bg-church-primary p-1.5 rounded-full border-2 border-white shadow-sm">
                            <Church className="w-3 h-3 text-church-dark" />
                          </div>
                        )}
                       </div>
                       <div className="text-center">
                        <CardTitle className="text-base font-bold uppercase tracking-tight">{member.userId === user.uid ? 'Você' : `Membro ${member.userId.slice(0, 5)}`}</CardTitle>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">ID: {member.userId}</p>
                       </div>
                       <Badge className={`rounded-none px-3 font-bold tracking-widest text-[9px] uppercase ${member.role === 'ADMIN' ? 'bg-church-dark text-church-primary' : 'bg-zinc-100 text-zinc-500'}`}>
                         {member.role === 'ADMIN' ? 'LÍDER' : 'MEMBRO'}
                       </Badge>
                     </CardHeader>
                     {(isSuperAdmin || userRole === 'ADMIN') && member.userId !== user.uid && (
                        <CardFooter className="bg-zinc-50/50 p-2 flex justify-center border-t border-zinc-100">
                          <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-white hover:bg-red-500 w-full rounded-none font-bold uppercase tracking-widest" onClick={() => deleteDoc(doc(db, 'organizations', currentOrg.id, 'members', member.userId))}>
                            Remover
                          </Button>
                        </CardFooter>
                     )}
                   </Card>
                 ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}

function LoadingScreen() { 
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-church-cream font-roboto">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
        <Music className="w-10 h-10 text-church-dark" />
      </motion.div>
      <p className="text-zinc-500 font-bold uppercase tracking-widest animate-pulse">Sintonizando Aplaine...</p>
    </div>
  ); 
}

function LandingPage({ signIn }: { signIn: () => void }) { 
  return (
    <main className="flex flex-col min-h-screen bg-church-cream font-roboto text-church-dark">
      {/* Header */}
      <header className="bg-church-dark text-white py-4 px-6 md:px-12 flex justify-between items-center fixed top-0 w-full z-50">
        <div className="flex items-center gap-2">
          <Church className="w-6 h-6 text-church-primary" />
          <span className="text-xl font-bold tracking-tight uppercase">Aplaine</span>
        </div>
        <nav className="hidden lg:flex items-center gap-10 text-sm font-medium">
          <a href="#" className="hover:text-church-primary transition-colors uppercase">Início</a>
          <a href="#" className="hover:text-church-primary transition-colors uppercase">Sobre Nós</a>
          <a href="#" className="hover:text-church-primary transition-colors uppercase">Ministérios</a>
          <a href="#" className="hover:text-church-primary transition-colors uppercase">Blog</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" className="hidden sm:inline-flex text-xs text-zinc-400 hover:text-white font-bold uppercase">Admin</Button>
          </Link>
          <Button onClick={signIn} className="bg-church-primary text-church-dark hover:bg-church-primary/90 font-bold px-8 rounded-md text-sm uppercase">Fazer Login</Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col justify-center items-start text-white pt-20 overflow-hidden">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <Image 
          src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2000&auto=format&fit=crop" 
          alt="Church Worship" 
          fill
          className="absolute inset-0 w-full h-full object-cover scale-105 animate-pulse-slow"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-20 px-6 md:px-24 max-w-4xl">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold tracking-[0.2em] mb-4 uppercase text-church-primary">Bem-vindo à nossa comunidade</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-6xl md:text-8xl font-bold leading-tight mb-8 uppercase">FAÇA PARTE DA NOSSA COMUNIDADE</motion.h1>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
            <Button size="lg" className="bg-church-primary text-church-dark hover:bg-church-primary/90 font-bold px-10 h-16 rounded-md text-lg uppercase transition-transform hover:scale-105">Saiba Mais</Button>
          </motion.div>
          <div className="mt-12 flex gap-4 items-center border-l-2 border-church-primary pl-4">
            <p className="text-zinc-300 max-w-xs text-sm">Simplifique a gestão do seu ministério de louvor. Escalas, repertório e comunicação em um só lugar.</p>
          </div>
        </div>
      </section>

      {/* Relevant Section */}
      <section className="py-24 px-6 md:px-24 bg-church-cream">
        <div className="text-center mb-16">
          <p className="text-sm font-bold italic mb-4 uppercase tracking-widest text-zinc-500">Nosso Propósito</p>
          <h2 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">UMA IGREJA RELEVANTE</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring' }}>
            <Card className="bg-white border-0 shadow-sm rounded-none p-8 flex flex-col items-start gap-4 h-full">
              <div className="w-12 h-12 bg-church-primary/20 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-church-dark" />
              </div>
              <h3 className="text-2xl font-bold uppercase">Sobre Nós</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">Focados em servir e crescer como um corpo unido em Cristo, facilitando a organização ministerial.</p>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring' }}>
            <Card className="bg-white border-0 shadow-sm rounded-none p-8 flex flex-col items-start gap-4 h-full">
              <div className="w-12 h-12 bg-church-primary/20 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-church-dark" />
              </div>
              <h3 className="text-2xl font-bold uppercase">Escalas</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">Gerencie escalas de forma intuitiva, garantindo que todos estejam sintonizados e preparados.</p>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring' }}>
            <Card className="bg-white border-0 shadow-sm rounded-none p-8 flex flex-col items-start gap-4 h-full">
              <div className="w-12 h-12 bg-church-primary/20 rounded-full flex items-center justify-center">
                <Music className="w-6 h-6 text-church-dark" />
              </div>
              <h3 className="text-2xl font-bold uppercase">Repertório</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">Catálogo completo de músicas com links, tons e BPM para agilizar os ensaios do ministério.</p>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Compassion Section */}
      <section className="py-24 px-6 md:px-24 border-t border-zinc-200">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <p className="text-sm font-bold italic mb-4 uppercase tracking-widest text-zinc-500">Nossa Missão & Visão</p>
            <h2 className="text-5xl font-bold leading-tight uppercase">AMOR E COMPAIXÃO</h2>
            <p className="text-zinc-500 leading-relaxed text-lg">
              Nosso objetivo é proporcionar ferramentas que permitam aos líderes se concentrarem no que realmente importa: a adoração e o serviço à comunidade.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div>
                <h4 className="font-bold text-xl uppercase mb-2">Missão</h4>
                <p className="text-sm text-zinc-500">Servir ao ministério de louvor com excelência tecnológica.</p>
              </div>
              <div>
                <h4 className="font-bold text-xl uppercase mb-2">Visão</h4>
                <p className="text-sm text-zinc-500">Ser a maior plataforma de apoio ao louvor local.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative w-full h-80 mt-12">
              <Image src="https://images.unsplash.com/photo-1544427920-c49ccfb85579?q=80&w=1000&auto=format&fit=crop" fill className="object-cover rounded-md" alt="Community" referrerPolicy="no-referrer" />
            </div>
            <div className="relative w-full h-80">
              <Image src="https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?q=80&w=1000&auto=format&fit=crop" fill className="object-cover rounded-md" alt="Worship" referrerPolicy="no-referrer" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-church-dark text-white py-20 px-6 md:px-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <Church className="w-6 h-6 text-church-primary" />
              <span className="text-2xl font-bold tracking-tight uppercase">Aplaine</span>
            </div>
            <p className="text-zinc-500 text-sm">© Copyright Aplaine 2026. Todos os direitos reservados.</p>
          </div>
          <div>
            <h4 className="font-bold mb-6 uppercase">Links Úteis</h4>
            <div className="flex flex-col gap-3 text-zinc-400 text-sm">
              <a href="#" className="hover:text-church-primary transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-church-primary transition-colors">Privacidade</a>
              <a href="#" className="hover:text-church-primary transition-colors">Suporte</a>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6 uppercase">Siga-nos</h4>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-church-primary hover:text-church-dark cursor-pointer transition-colors"><Send className="w-4 h-4" /></div>
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-church-primary hover:text-church-dark cursor-pointer transition-colors"><MessageSquare className="w-4 h-4" /></div>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider">ASSINE NOSSA NEWSLETTER</h4>
            <div className="flex">
              <input type="email" placeholder="seu@email.com" className="bg-transparent border border-zinc-800 p-4 flex-1 text-sm outline-none focus:border-church-primary" />
              <Button className="bg-church-primary text-church-dark rounded-none px-6 h-auto hover:bg-church-primary/90 font-bold uppercase transition-colors">Enviar</Button>
            </div>
          </div>
        </div>
      </footer>
    </main>
  ); 
}

function OrgSelection({ user, orgs, isCreating, setIsCreating, newOrgData, setNewOrgData, handleCreate, handleCepLookup, selectOrg, logOut, isSuperAdmin }: any) { 
  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-6 bg-church-cream font-roboto">
      <Card className="w-full max-w-2xl border-zinc-200 shadow-2xl rounded-none overflow-hidden bg-white">
        <div className="bg-gradient-to-br from-church-primary/10 to-transparent p-10 flex justify-between items-center border-b border-church-primary/20 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-church-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-church-dark rounded-none">
                <Church className="w-6 h-6 text-church-primary" />
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-tighter text-church-dark">Painel {isSuperAdmin ? 'Administrativo' : 'do Líder'}</h2>
            </div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Selecione ou cadastre uma nova instância para gerenciar.</p>
          </div>
          {isSuperAdmin && (
            <Badge className="bg-church-primary text-church-dark rounded-none font-bold px-3 py-1 shadow-sm border border-church-dark/10 relative z-10">
              SISTEMA MASTER
            </Badge>
          )}
        </div>
        <CardContent className="p-8 space-y-8">
          <AnimatePresence mode="popLayout">
            {orgs.length > 0 && !isCreating && (
              <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {orgs.map((org: any) => (
                  <Button 
                    key={org.id} 
                    variant="outline" 
                    className="w-full justify-between h-24 rounded-none border-zinc-100 hover:border-church-primary hover:bg-church-primary/5 transition-all group p-5 shadow-sm hover:shadow-md" 
                    onClick={() => selectOrg(org.id)}
                  >
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="truncate w-full text-left font-bold uppercase text-base tracking-tight text-church-dark group-hover:text-church-primary transition-colors">{org.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[9px] bg-zinc-100 text-zinc-500 rounded-none font-bold tracking-widest">{org.ministry?.acronym || 'ORG'}</Badge>
                        <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-tighter">Acessar Painel</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full border border-zinc-100 flex items-center justify-center group-hover:bg-church-primary group-hover:border-church-primary transition-all">
                      <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity text-church-dark" />
                    </div>
                  </Button>
                ))}
              </motion.div>
            )}
            
            {isCreating ? (
              <motion.form key="form" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} onSubmit={handleCreate} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <h3 className="font-bold border-b border-church-primary/20 pb-2 flex items-center gap-2 uppercase text-xs tracking-[0.2em] text-church-dark"><Church className="w-4 h-4 text-church-primary"/> Dados da Igreja</h3>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nome da Congregação</Label>
                       <Input value={newOrgData.name} onChange={e => setNewOrgData({...newOrgData, name: e.target.value})} required className="rounded-none border-zinc-200 focus:border-church-primary h-11 bg-zinc-50/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">CEP</Label><Input value={newOrgData.cep} onBlur={(e) => handleCepLookup(e.target.value)} onChange={e => setNewOrgData({...newOrgData, cep: e.target.value})} placeholder="00000-000" className="rounded-none border-zinc-200 focus:border-church-primary h-11" /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Número</Label><Input value={newOrgData.number} onChange={e => setNewOrgData({...newOrgData, number: e.target.value})} className="rounded-none border-zinc-200 focus:border-church-primary h-11" /></div>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Telefone Contato</Label><Input value={newOrgData.phone} onChange={e => setNewOrgData({...newOrgData, phone: e.target.value})} className="rounded-none border-zinc-200 focus:border-church-primary h-11" /></div>
                  </div>

                  <div className="space-y-5">
                    <h3 className="font-bold border-b border-church-primary/20 pb-2 flex items-center gap-2 uppercase text-xs tracking-[0.2em] text-church-dark"><Music className="w-4 h-4 text-church-primary"/> Ministério de Louvor</h3>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nome do Ministério</Label><Input value={newOrgData.ministryName} onChange={e => setNewOrgData({...newOrgData, ministryName: e.target.value})} required className="rounded-none border-zinc-200 focus:border-church-primary h-11 bg-zinc-50/50" /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1 space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sigla</Label><Input value={newOrgData.ministryAcronym} onChange={e => setNewOrgData({...newOrgData, ministryAcronym: e.target.value})} placeholder="MLD" className="rounded-none border-zinc-200 focus:border-church-primary h-11" /></div>
                      <div className="col-span-2 space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Líder Responsável</Label><Input value={newOrgData.ministryLeader} onChange={e => setNewOrgData({...newOrgData, ministryLeader: e.target.value})} className="rounded-none border-zinc-200 focus:border-church-primary h-11" /></div>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Breve Descrição</Label><Input value={newOrgData.ministryDesc} onChange={e => setNewOrgData({...newOrgData, ministryDesc: e.target.value})} className="rounded-none border-zinc-200 focus:border-church-primary h-11" /></div>
                  </div>
                </div>
                <div className="flex gap-3 pt-6 border-t border-zinc-100">
                  <Button type="submit" className="flex-1 h-14 rounded-none bg-church-dark text-church-primary hover:bg-church-dark/95 font-bold uppercase tracking-widest text-sm shadow-lg shadow-church-dark/10">Registrar e Iniciar</Button>
                  <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} className="h-14 rounded-none uppercase text-xs font-bold text-zinc-400 hover:text-church-dark px-8">Voltar</Button>
                </div>
              </motion.form>
            ) : (
              isSuperAdmin ? (
                <Button 
                  variant="outline" 
                  className="w-full border-dashed border-2 h-24 rounded-none border-church-primary/30 hover:border-church-primary hover:bg-church-primary/5 uppercase font-bold text-xs tracking-[0.3em] transition-all flex flex-col gap-2 group" 
                  onClick={() => setIsCreating(true)}
                >
                  <Plus className="w-6 h-6 text-church-primary group-hover:scale-110 transition-transform" />
                  <span>Cadastrar Novo Ministério</span>
                </Button>
              ) : (
                <div className="py-12 px-6 bg-zinc-50 border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center text-center gap-4">
                  <div className="p-3 bg-white rounded-full shadow-sm">
                    <Clock className="w-6 h-6 text-zinc-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-tighter text-church-dark">Aguardando Vinculação</h4>
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mt-1 max-w-[240px]">
                      Você ainda não faz parte de um ministério. Solicite ao administrador master para ser adicionado.
                    </p>
                  </div>
                </div>
              )
            )}
          </AnimatePresence>
        </CardContent>
        <CardFooter className="bg-zinc-50/50 p-6 flex justify-between items-center border-t border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-church-primary animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Conectado ao Aplaine Cloud</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logOut} className="text-zinc-500 hover:text-church-dark uppercase text-[10px] font-bold tracking-widest flex items-center gap-2">
            Desconectar <LogOut className="w-3 h-3" />
          </Button>
        </CardFooter>
      </Card>
    </main>
  ); 
}

function SidebarItem({ icon, label, active = false, onClick }: any) { 
  return (
    <Button 
      variant={active ? "secondary" : "ghost"} 
      onClick={onClick} 
      className={`w-full justify-start font-bold h-12 px-4 rounded-md transition-all uppercase text-xs tracking-wider ${active ? 'bg-church-primary text-church-dark translate-x-1' : 'text-zinc-500 hover:text-church-dark'}`}
    >
      <span className={`mr-3 ${active ? 'text-church-dark' : 'text-zinc-400'}`}>{icon}</span>
      {label}
    </Button>
  ); 
}

function MemberAvatar({ initials, color }: { initials: string, color: string }) { return (<div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold ${color}`}>{initials}</div>); }
