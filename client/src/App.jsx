import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Coffee, Crown, LogOut, Menu, MessageCircle, Mic, MicOff, MoreHorizontal, Pause, Play, Plus, Send, Settings, Sparkles, Timer, Users, Video, VideoOff, X } from 'lucide-react'

const people = [
  { name: 'Minh Anh', initials: 'MA', color: '#5d5fef', status: 'Đang tập trung' },
  { name: 'Hoàng Nam', initials: 'HN', color: '#b65700', status: 'Đang tập trung' },
  { name: 'Thu Hà', initials: 'TH', color: '#27825b', status: 'Tạm nghỉ' },
  { name: 'Bạn', initials: 'B', color: '#904400', status: 'Sẵn sàng' },
]

function Logo() { return <div className="logo"><span><BookOpen size={22}/></span>StudySync</div> }

function JoinRoom() {
  const nav = useNavigate(); const [mic, setMic] = useState(true); const [cam, setCam] = useState(true)
  return <main className="join-page"><div className="join-shell">
    <section className="preview-side">
      <div className={`video-preview ${cam ? '' : 'camera-off'}`}>
        {cam ? <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=85" alt="Học sinh đang học nhóm"/> : <div className="avatar-xl">B</div>}
        <span className="name-tag">Bạn</span>
      </div>
      <div className="media-controls">
        <button className={!mic ? 'danger' : ''} onClick={() => setMic(v => !v)} aria-label="Bật tắt micro">{mic ? <Mic/> : <MicOff/>}</button>
        <button className={!cam ? 'danger' : ''} onClick={() => setCam(v => !v)} aria-label="Bật tắt camera">{cam ? <Video/> : <VideoOff/>}</button>
        <button aria-label="Cài đặt"><Settings/></button>
      </div>
      <p className="hint">Kiểm tra camera và micro trước khi tham gia. Bạn có thể thay đổi sau.</p>
    </section>
    <section className="join-info">
      <button className="back-link"><ArrowLeft size={18}/> Quay lại</button>
      <div><p className="eyebrow">Sẵn sàng tham gia?</p><h1>Ôn tập Giải tích nâng cao</h1><p className="host-line"><span className="avatar-sm">PL</span> Được tổ chức bởi <strong>Phương Linh</strong></p></div>
      <div className="details"><h3>Thông tin phiên học</h3><div className="chips"><span><Timer/>25 phút tập trung</span><span><Coffee/>5 phút nghỉ</span><span><Users/>20 thành viên</span><span><MessageCircle/>Có trò chuyện</span></div></div>
      <div className="actions"><button className="btn primary" onClick={() => nav('/room')}>Tham gia phòng <ArrowRight/></button><button className="btn secondary">Quay về trang chủ</button></div>
    </section>
  </div></main>
}

function Room() {
 const nav=useNavigate(); const [running,setRunning]=useState(true); const [chat,setChat]=useState(true); const [message,setMessage]=useState(''); const [messages,setMessages]=useState(['Minh Anh: Cố lên mọi người!','Hoàng Nam: Còn 12 phút nữa nhé.'])
 const send=()=>{if(message.trim()){setMessages(v=>[...v,`Bạn: ${message.trim()}`]);setMessage('')}}
 return <div className="app-page"><header className="topbar"><Logo/><div className="room-title"><strong>Ôn tập Giải tích nâng cao</strong><span>Phòng #CAL-2407</span></div><div className="header-actions"><button className="icon-btn"><Settings/></button><button className="leave" onClick={()=>nav('/join')}><LogOut/> Rời phòng</button></div></header>
 <div className="room-grid"><section className="focus-area"><div className="focus-head"><div><span className="live-dot"/> PHIÊN TẬP TRUNG</div><button className="icon-btn mobile"><Menu/></button></div>
 <div className="timer-card"><div className="timer-ring"><span>12:48</span><small>còn lại</small></div><h1>Giữ nhịp tập trung nhé!</h1><p>Một chút kiên trì hôm nay sẽ tạo nên kết quả lớn ngày mai.</p><div className="timer-actions"><button className="round" onClick={()=>setRunning(v=>!v)}>{running?<Pause/>:<Play/>}</button><button className="round ghost"><MoreHorizontal/></button></div></div>
 <div className="participants"><div className="section-title"><h2>Đang học cùng bạn</h2><span>{people.length} người</span></div><div className="people-grid">{people.map((p,i)=><article className="person" key={p.name}><div className="person-video" style={{background:`linear-gradient(145deg, ${p.color}22, ${p.color}55)`}}><div className="avatar" style={{background:p.color}}>{p.initials}</div>{i===0?<span className="host-badge"><Crown/> Host</span>:null}<span className="mic-badge"><Mic size={14}/></span></div><div><strong>{p.name}</strong><span>{p.status}</span></div></article>)}</div></div></section>
 <aside className={`chat-panel ${chat?'':'closed'}`}><div className="chat-head"><div><h2>Trò chuyện</h2><span>4 thành viên trực tuyến</span></div><button className="icon-btn" onClick={()=>setChat(false)}><X/></button></div><div className="messages">{messages.map((m,i)=><div className="message" key={i}><span className="avatar-xs">{m[0]}</span><p>{m}</p></div>)}</div><div className="composer"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Nhắn điều gì đó..."/><button onClick={send}><Send/></button></div></aside>
 {!chat?<button className="chat-fab" onClick={()=>setChat(true)}><MessageCircle/></button>:null}</div></div>
}

function Dashboard(){const nav=useNavigate();return <div className="app-page"><header className="topbar"><Logo/><nav><button className="active">Không gian học</button><button>Bộ thẻ</button><button>Tiến độ</button></nav><div className="user-menu"><span className="avatar-sm">B</span><strong>Bạn</strong><ChevronRight/></div></header><main className="dashboard"><section className="welcome"><div><p>Chào buổi tối 👋</p><h1>Sẵn sàng học cùng nhau?</h1><span>Tạo một không gian tập trung hoặc tham gia cùng bạn bè.</span></div><button className="btn primary" onClick={()=>nav('/join')}><Plus/> Tạo phòng học</button></section><section><div className="section-title"><h2>Phòng đang hoạt động</h2><button>Xem tất cả <ChevronRight/></button></div><div className="room-list"><article className="room-card"><div className="room-visual"><Sparkles/><span>ĐANG DIỄN RA</span></div><div className="room-content"><div><h3>Ôn tập Giải tích nâng cao</h3><p>Phương Linh đang tổ chức</p></div><div className="room-meta"><span><Timer/> 25 / 5 phút</span><span><Users/> 4 / 20</span></div><div className="avatar-stack">{people.slice(0,3).map(p=><span key={p.name} style={{background:p.color}}>{p.initials}</span>)}</div><button className="btn primary" onClick={()=>nav('/join')}>Tham gia <ArrowRight/></button></div></article><article className="empty-card"><div><Coffee/></div><h3>Tạo không gian riêng</h3><p>Học theo nhịp của bạn với đồng hồ Pomodoro và bộ thẻ yêu thích.</p><button className="btn secondary"><Plus/> Bắt đầu</button></article></div></section><section className="recent"><div className="section-title"><h2>Hoạt động gần đây</h2></div><div className="activity"><span className="activity-icon"><Check/></span><div><strong>Hoàn thành phiên “Từ vựng IELTS”</strong><p>25 phút tập trung · Hôm qua</p></div><span className="streak">+25 phút</span></div></section></main></div>}

export default function App(){return <Routes><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/join" element={<JoinRoom/>}/><Route path="/room" element={<Room/>}/></Routes>}
