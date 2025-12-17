import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch } from 'firebase/firestore';
import { TrendingUp, TrendingDown, Users, Tag, Plus, Minus, CheckCircle, Gift, Loader, X, ExternalLink, CheckSquare, Square, Edit3, Trash2, Save, ArrowLeft, School, ArrowUpDown, RotateCcw, AlertTriangle, PenTool, LogIn, LogOut } from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const userFirebaseConfig = {
  apiKey: "AIzaSyCFRIBnUJH2Z8tOInRI5dCqBAkdBobDfyQ",
  authDomain: "classmanagement-score.firebaseapp.com",
  projectId: "classmanagement-score",
  storageBucket: "classmanagement-score.firebasestorage.app",
  messagingSenderId: "142763430728",
  appId: "1:142763430728:web:60a9c265f543ed6de8597d",
  measurementId: "G-5TYWM9B73Z"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-class-app';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Sub Components ---

const TabButton = ({ tab, current, setActive, children }) => (
    <button
        className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-colors duration-200 text-sm whitespace-nowrap flex justify-center items-center
            ${current === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}
        onClick={() => setActive(tab)}
    >
        {children}
    </button>
);

const ScoreDisplay = ({ totalScore, studentCount, userId, className }) => (
    <div className="bg-indigo-600 p-5 rounded-2xl shadow-2xl text-white mb-6 flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
            <p className="text-lg font-light opacity-80 flex items-center gap-2"><School className="w-5 h-5"/> {className}</p>
            <p className="text-5xl font-extrabold mt-1">{totalScore}</p>
        </div>
        <div className="text-right relative z-10">
            <p className="text-lg font-light opacity-80">學生總數</p>
            <p className="text-3xl font-extrabold mt-1">{studentCount} 人</p>
            <p className="text-xs opacity-60 mt-1 truncate max-w-[100px]">ID: {userId ? userId.substring(0, 6) : '...'}</p>
        </div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full opacity-50 z-0"></div>
    </div>
);

// 優化後的學生卡片：更緊湊、分數更醒目
const StudentCard = ({ student, isSelected, isGroupAction, groups, handleSelection, setActingStudent }) => {
    const studentGroupNames = groups
        .filter(g => (student.groupIds || []).includes(g.id) || student.groupId === g.id)
        .map(g => g.name);

    return (
        <div 
            className={`relative p-2 rounded-lg shadow-sm transition-all border flex flex-col justify-between h-[5.5rem] select-none
            ${isSelected 
                ? 'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-400' 
                : 'bg-white hover:shadow-md border-gray-200'}
            ${isGroupAction ? 'opacity-90' : ''}`}
            onClick={(e) => { 
                if (isGroupAction) {
                    handleSelection(student.id);
                } else {
                    setActingStudent(student);
                }
            }}
        >
            <div 
                className="absolute top-1 right-1 z-10 p-1 cursor-pointer text-gray-300 hover:text-indigo-500" 
                onClick={(e) => { e.stopPropagation(); handleSelection(student.id); }}
            >
                {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
            </div>
            
            <div className="flex flex-col h-full justify-between">
                <div className="pr-6">
                    <div className="font-bold text-sm text-gray-800 truncate leading-tight tracking-tight">
                        {student.name}
                    </div>
                    
                    <div className="flex flex-wrap gap-0.5 mt-0.5 h-3 overflow-hidden">
                        {studentGroupNames.length > 0 && (
                            <span className="text-[9px] text-gray-500 bg-gray-100 px-1 rounded-sm border border-gray-200 truncate max-w-full">
                                {studentGroupNames[0]}{studentGroupNames.length > 1 ? '...' : ''}
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="text-right -mt-1">
                    <span className={`text-4xl font-black tracking-tighter leading-none ${student.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {student.score}
                    </span>
                </div>
            </div>
        </div>
    );
};

const StudentActionPanel = ({ 
    isGroupAction, setIsGroupAction, 
    selectedGroup, setSelectedGroup, 
    selectedStudents, setSelectedStudents, 
    activeStudents, groups, 
    customScoreItems, scoreReason, setScoreReason, scoreDelta, setScoreDelta, 
    executeBatchScoreAction 
}) => {
    
    const handleSelectAll = () => {
        if (selectedStudents.length === activeStudents.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(activeStudents.map(s => s.id));
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-700">操作模式</h3>

            <div className="flex space-x-3">
                <button
                    className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center 
                        ${!isGroupAction 
                            ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300' 
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => { setIsGroupAction(false); setSelectedGroup(''); }}
                >
                    <Users className="w-4 h-4 mr-1.5" /> 多選學生
                </button>
                <button
                    className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center 
                        ${isGroupAction 
                            ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300' 
                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => { setIsGroupAction(true); setSelectedStudents([]); }}
                >
                    <Tag className="w-4 h-4 mr-1.5" /> 組別操作
                </button>
            </div>

            <div className="p-3 bg-white rounded-xl border border-gray-200 min-h-[4rem] shadow-sm">
                {isGroupAction && (
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">請選擇組別</p>
                        <div className="flex flex-wrap gap-2">
                            {groups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => setSelectedGroup(group.id === selectedGroup ? '' : group.id)}
                                    className={`px-3 py-1.5 rounded-lg border transition-all flex items-center font-medium text-sm
                                        ${selectedGroup === group.id 
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                >
                                    {selectedGroup === group.id && <CheckCircle className="w-3 h-3 mr-1.5"/>}
                                    {group.name} 
                                    <span className="ml-1 text-xs opacity-60">({group.members.length})</span>
                                </button>
                            ))}
                            {groups.length === 0 && <span className="text-gray-400 italic text-sm">無組別</span>}
                        </div>
                    </div>
                )}

                {!isGroupAction && (
                    <>
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">已選學生</p>
                            <button 
                                onClick={handleSelectAll}
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                            >
                                {selectedStudents.length > 0 && selectedStudents.length === activeStudents.length ? '取消全選' : '全選所有'}
                            </button>
                        </div>
                        {selectedStudents.length > 0 ? (
                             <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {selectedStudents.length === activeStudents.length ? (
                                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded w-full text-center font-medium">
                                        全體學生 ({activeStudents.length} 人)
                                    </span>
                                ) : (
                                    activeStudents.filter(s => selectedStudents.includes(s.id)).map(s => (
                                        <span key={s.id} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded flex items-center">
                                            {s.name} <X className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" onClick={(e) => { e.stopPropagation(); setSelectedStudents(prev => prev.filter(id => id !== s.id)); }} />
                                        </span>
                                    ))
                                )}
                             </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic py-1">請在右側勾選</p>
                        )}
                    </>
                )}
            </div>

            <div className="border-t pt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">加減分內容</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {customScoreItems.map(item => (
                        <button
                            key={item.id}
                            className={`p-2 rounded-lg shadow-sm border transition-all relative overflow-hidden flex flex-col justify-center min-h-[3.5rem] active:scale-95
                                ${scoreReason === item.reason ? 'bg-yellow-50 border-yellow-400 ring-1 ring-yellow-400' : 'bg-white border-gray-200 hover:bg-gray-50'}
                            `}
                            onClick={() => { setScoreReason(item.reason); setScoreDelta(item.delta); }}
                        >
                            <div className="flex justify-between items-center w-full relative z-10 px-1">
                                <span className="font-medium text-xs whitespace-normal text-left mr-1 leading-tight break-words flex-1 text-gray-800">
                                    {item.reason}
                                </span>
                                <span className={`text-lg font-bold flex-shrink-0 ${item.type === 'plus' ? 'text-green-600' : 'text-red-500'}`}>
                                    {item.delta > 0 ? '+' : ''}{item.delta}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                        <Edit3 className="w-3 h-3 text-gray-400"/>
                        <span className="text-xs font-bold text-gray-500">自定義調整</span>
                    </div>
                    
                    <input 
                        type="text" 
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                        placeholder="輸入原因"
                        value={scoreReason}
                        onChange={(e) => setScoreReason(e.target.value)}
                    />
                    
                    <div className="flex items-center gap-2">
                        <button 
                            className="w-10 h-10 rounded border border-gray-300 bg-white text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-100 active:bg-gray-200"
                            onClick={() => setScoreDelta(prev => prev - 1)}
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <input 
                            type="number" 
                            className="flex-1 h-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-center text-lg bg-white"
                            placeholder="0"
                            value={scoreDelta}
                            onChange={(e) => setScoreDelta(parseInt(e.target.value) || 0)}
                        />
                        <button 
                            className="w-10 h-10 rounded border border-gray-300 bg-white text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-100 active:bg-gray-200"
                            onClick={() => setScoreDelta(prev => prev + 1)}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <button
                className={`w-full py-3 rounded-xl text-white font-bold text-lg shadow-md transition-all duration-200 mt-2 flex items-center justify-center
                ${(selectedStudents.length || (isGroupAction && selectedGroup)) && scoreDelta !== 0
                        ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
                        : 'bg-gray-300 cursor-not-allowed opacity-70'
                    }`}
                disabled={(!selectedStudents.length && !(isGroupAction && selectedGroup)) || scoreDelta === 0}
                onClick={executeBatchScoreAction}
            >
               <CheckCircle className="w-5 h-5 mr-2" />
               執行：{scoreDelta > 0 ? '加' : (scoreDelta < 0 ? '減' : '變動')} {Math.abs(scoreDelta)} 分
            </button>
        </div>
    );
};

const ScoreItemEditor = ({ items, onSave, onDelete }) => {
    const [reason, setReason] = useState('');
    const [delta, setDelta] = useState(5);
    const [type, setType] = useState('plus');
    const [editingId, setEditingId] = useState(null);

    const resetForm = () => { setReason(''); setDelta(5); setType('plus'); setEditingId(null); };

    return (
        <div>
            <div className="p-4 border rounded-lg mb-4 bg-gray-50">
                <h4 className="font-bold mb-2">{editingId ? '編輯項目' : '新增項目'}</h4>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                     <input type="text" placeholder="原因" className="flex-grow p-2 border rounded-lg" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <input type="number" placeholder="分數" className="w-full sm:w-1/3 p-2 border rounded-lg" value={delta} onChange={(e) => setDelta(parseInt(e.target.value) || 0)} />
                    <select className="w-full sm:w-1/3 p-2 border rounded-lg" value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="plus">加分 (+)</option>
                        <option value="minus">減分 (-)</option>
                    </select>
                    <button className="w-full sm:w-1/3 p-2 bg-green-500 text-white rounded-lg" onClick={() => { onSave(reason, type === 'plus' ? delta : -delta, type, editingId); resetForm(); }} disabled={!reason || delta === 0}>
                        {editingId ? '儲存' : '新增'}
                    </button>
                </div>
                {editingId && <button onClick={resetForm} className="text-xs text-gray-500">取消</button>}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-white border rounded-lg">
                        <span className="text-sm">{item.reason}</span>
                        <div className="flex items-center space-x-2">
                            <span className={`font-bold ${item.type === 'plus' ? 'text-green-600' : 'text-red-600'}`}>{item.delta > 0 ? '+' : ''}{item.delta}</span>
                            <button onClick={() => {setReason(item.reason); setDelta(Math.abs(item.delta)); setType(item.type); setEditingId(item.id);}}><Edit3 className="w-3 h-3 text-blue-500"/></button>
                            <button onClick={() => onDelete(item.id)}><Trash2 className="w-3 h-3 text-red-500"/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RedeemItemEditor = ({ items, onSave, onDelete }) => {
    const [itemName, setItemName] = useState('');
    const [cost, setCost] = useState(10);
    const [editingId, setEditingId] = useState(null);
    const resetForm = () => { setItemName(''); setCost(10); setEditingId(null); };

    return (
        <div>
            <div className="p-4 border rounded-lg mb-4 bg-gray-50">
                <h4 className="font-bold mb-2">{editingId ? '編輯兌換' : '新增兌換'}</h4>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input type="text" placeholder="品名" className="flex-grow p-2 border rounded-lg" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                    <input type="number" placeholder="分" className="w-full sm:w-20 p-2 border rounded-lg" value={cost} onChange={(e) => setCost(parseInt(e.target.value) || 0)} />
                </div>
                 <button className="w-full p-2 bg-green-500 text-white rounded-lg" onClick={() => { onSave(itemName, cost, editingId); resetForm(); }} disabled={!itemName || cost <= 0}>
                    {editingId ? '儲存' : '新增'}
                </button>
                 {editingId && <button onClick={resetForm} className="text-xs text-gray-500 mt-2">取消</button>}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-white border rounded-lg">
                        <span className="text-sm">{item.item}</span>
                        <div className="flex items-center space-x-2">
                            <span className="font-bold text-green-700">-{item.cost}</span>
                            <button onClick={() => {setItemName(item.item); setCost(item.cost); setEditingId(item.id);}}><Edit3 className="w-3 h-3 text-blue-500"/></button>
                            <button onClick={() => onDelete(item.id)}><Trash2 className="w-3 h-3 text-red-500"/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SetupPanel = ({
    newStudentName, setNewStudentName, addStudent, activeStudents, deleteStudent,
    newGroupName, setNewGroupName, addGroup, groups, setIsEditingGroup, setCurrentGroupStudents, deleteGroup, renameGroup,
    customScoreItems, handleSaveScoreItem, handleDeleteScoreItem,
    redeemItems, handleSaveRedeemItem, handleDeleteRedeemItem,
    deleteClass, resetAllScores,
    user, handleGoogleLogin, handleLogout
}) => {
    
    // 移除更名功能，僅保留刪除與成員管理
    const handleDeleteGroup = (e, group) => {
        e.stopPropagation();
        if(window.confirm(`確定刪除群組「${group.name}」嗎？這會同時移除所有學生的此群組標籤。`)) {
            deleteGroup(group.id);
        }
    };

    return (
    <div className="space-y-8">
        {/* Auth Section */}
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-indigo-800 flex items-center"><School className="w-5 h-5 mr-2"/> 帳號同步</h2>
                <p className="text-sm text-indigo-600">
                    {user?.isAnonymous ? '目前為訪客模式，資料僅保留於此裝置。登入 Google 以跨裝置同步。' : `已登入：${user?.email}`}
                </p>
            </div>
            {user?.isAnonymous ? (
                <button onClick={handleGoogleLogin} className="flex items-center bg-white text-indigo-600 px-4 py-2 rounded-lg shadow font-bold hover:bg-gray-50">
                    <LogIn className="w-4 h-4 mr-2"/> Google 登入同步
                </button>
            ) : (
                <button onClick={handleLogout} className="flex items-center bg-white text-gray-600 px-4 py-2 rounded-lg shadow font-bold hover:bg-gray-50">
                    <LogOut className="w-4 h-4 mr-2"/> 登出
                </button>
            )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-red-50 p-4 rounded-xl border border-red-100">
             <div>
                 <h2 className="text-xl font-bold text-gray-800 flex items-center"><AlertTriangle className="w-5 h-5 text-red-500 mr-2"/> 危險操作區</h2>
                 <p className="text-sm text-gray-600">請小心使用以下功能，資料刪除後無法復原。</p>
             </div>
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                 <button 
                    onClick={() => { if(window.confirm('確定要將全班所有學生的分數歸零嗎？這將無法復原。')) resetAllScores(); }}
                    className="text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm flex items-center justify-center font-bold w-full sm:w-auto"
                 >
                    <RotateCcw className="w-4 h-4 mr-1"/> 全班分數歸零
                 </button>
                 <button 
                    onClick={() => { if(window.confirm('確定要刪除整個班級嗎？所有資料將消失。')) deleteClass(); }}
                    className="text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm flex items-center justify-center font-bold w-full sm:w-auto"
                 >
                    <Trash2 className="w-4 h-4 mr-1"/> 刪除此班級
                 </button>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 1. 學生名單 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4 flex items-center">
                    <Users className="w-5 h-5 mr-2 text-indigo-500" /> 學生名單
                </h3>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
                    <input
                        type="text"
                        placeholder="輸入姓名 (如: 01 小明)"
                        className="flex-grow p-2 border border-gray-300 rounded-lg"
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addStudent()}
                    />
                    <button className="p-2 bg-indigo-600 text-white rounded-lg whitespace-nowrap w-full sm:w-auto" onClick={addStudent}>
                        新增
                    </button>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                    {activeStudents.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true})).map(s => (
                        <div key={s.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                            <span className="font-medium">{s.name}</span>
                            <div className="flex items-center space-x-3">
                                <span className={`font-bold ${s.score >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.score}</span>
                                <button onClick={() => deleteStudent(s.id)} className="text-red-500 hover:bg-red-100 p-1 rounded"><X className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. 群組管理 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4 flex items-center">
                    <Tag className="w-5 h-5 mr-2 text-indigo-500" /> 群組管理
                </h3>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
                    <input
                        type="text"
                        placeholder="輸入群組名稱"
                        className="flex-grow p-2 border border-gray-300 rounded-lg"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addGroup()}
                    />
                    <button className="p-2 bg-indigo-600 text-white rounded-lg whitespace-nowrap w-full sm:w-auto" onClick={addGroup}>
                        新增
                    </button>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {groups.map(g => (
                        <div key={g.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
                            <span className="font-medium">{g.name} <span className="text-gray-500 text-sm">({g.members.length}人)</span></span>
                            <div className="flex gap-2">
                                <button className="text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 flex items-center" onClick={() => { setIsEditingGroup(g); setCurrentGroupStudents(g.members); }}>
                                    <Users className="w-3 h-3 mr-1"/> 成員
                                </button>
                                {/* 根據需求，移除更名按鈕，僅保留成員管理和刪除 */}
                                <button className="text-sm bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200" onClick={(e) => handleDeleteGroup(e, g)}>
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* 3 & 4 items config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-indigo-500" /> 加減分項目</h3>
                <ScoreItemEditor items={customScoreItems} onSave={handleSaveScoreItem} onDelete={handleDeleteScoreItem} />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4 flex items-center"><Gift className="w-5 h-5 mr-2 text-indigo-500" /> 兌換項目</h3>
                <RedeemItemEditor items={redeemItems} onSave={handleSaveRedeemItem} onDelete={handleDeleteRedeemItem} />
            </div>
        </div>
    </div>
    );
};

const RedeemPanel = ({ redeemItems, selectedStudents, activeStudents, executeRedeem, sortedStudents, setSelectedStudents, redeemNote, setRedeemNote }) => {
    const [customItem, setCustomItem] = useState('');
    const [customCost, setCustomCost] = useState('');

    const handleCustomRedeem = () => {
        if (!customItem || !customCost || selectedStudents.length !== 1) return;
        const student = activeStudents.find(s => s.id === selectedStudents[0]);
        if(student.score < parseInt(customCost)) return alert('分數不足');
        
        executeRedeem({ item: customItem, cost: parseInt(customCost) }, student);
        setCustomItem('');
        setCustomCost('');
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">分數兌換</h2>
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg border-l-4 border-yellow-500 text-sm">
                請先選擇一位學生，再點擊兌換項目。
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    {/* Custom Redeem (Redesigned) */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-xl font-semibold text-gray-700 flex items-center"><Edit3 className="inline w-5 h-5 mr-2" /> 自定義兌換</h3>
                            <button 
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:bg-gray-400 hover:bg-indigo-700 transition-colors"
                                disabled={!customItem || !customCost || selectedStudents.length !== 1}
                                onClick={handleCustomRedeem}
                            >
                                立即兌換
                            </button>
                        </div>
                        <div className="flex flex-col gap-3">
                            <input type="text" placeholder="輸入商品名稱" className="w-full p-3 border border-gray-300 rounded-lg text-base" value={customItem} onChange={e => setCustomItem(e.target.value)} />
                            <input type="number" placeholder="輸入所需點數" className="w-full p-3 border border-gray-300 rounded-lg text-base" value={customCost} onChange={e => setCustomCost(e.target.value)} />
                        </div>
                    </div>

                    {/* Preset Redeem */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <h3 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4"><Gift className="inline w-5 h-5 mr-2" /> 預設兌換品</h3>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {redeemItems.map(item => (
                                <div key={item.id} className="p-3 bg-green-50 rounded-xl border-l-4 border-green-500 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-gray-800">{item.item}</p>
                                        <p className="text-xs text-green-700">需 {item.cost} 分</p>
                                    </div>
                                    <button
                                        className={`px-3 py-1 rounded-full text-sm font-bold ${selectedStudents.length === 1 && activeStudents.find(s => s.id === selectedStudents[0])?.score >= item.cost ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                                        onClick={() => { if (selectedStudents.length === 1) { const s = activeStudents.find(st => st.id === selectedStudents[0]); if(s.score >= item.cost) executeRedeem(item, s); }}}
                                        disabled={selectedStudents.length !== 1 || activeStudents.find(s => s.id === selectedStudents[0])?.score < item.cost}
                                    >
                                        兌換
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                    <h3 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-4"><Users className="inline w-5 h-5 mr-2" /> 選擇學生 (單選)</h3>
                    <input type="text" placeholder="備註 (選填)" className="w-full p-2 border rounded mb-2 text-sm" value={redeemNote} onChange={(e) => setRedeemNote(e.target.value)} />
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {sortedStudents.map(s => (
                            <div key={s.id} onClick={() => setSelectedStudents(selectedStudents[0] === s.id ? [] : [s.id])}
                                className={`p-3 rounded-lg border cursor-pointer flex justify-between ${selectedStudents[0] === s.id ? 'bg-indigo-100 border-indigo-500' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                <span>{s.name}</span>
                                <span className={s.score >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{s.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HistoryPanel = ({ scoreHistory, exportToCSV, onDelete }) => (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">歷史記錄</h2>
        <div className="flex justify-end">
            <button className="flex items-center bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-600" onClick={() => exportToCSV(scoreHistory, 'history')}>
                <ExternalLink className="w-4 h-4 mr-2" /> 匯出 CSV
            </button>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {scoreHistory.map(h => (
                <div key={h.id} className={`p-3 rounded-lg border flex justify-between items-center ${h.delta > 0 ? 'bg-green-50 border-green-200' : h.type === '兌換' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex-grow">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{h.type}</span>
                            <span className="text-sm text-gray-600">({h.reason})</span>
                        </div>
                        <p className="text-xs text-gray-500">{h.targets.join(', ')} • {new Date(h.timestamp).toLocaleString('zh-TW')}</p>
                        {h.note && <p className="text-xs text-gray-400">備註: {h.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-xl font-bold ${h.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{h.delta > 0 ? '+' : ''}{h.delta}</span>
                        {/* 垃圾桶按鈕：使用傳入的 onDelete */}
                        <button 
                            onClick={() => onDelete(h)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="刪除此紀錄並復原分數"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
            {scoreHistory.length === 0 && <p className="text-center text-gray-400 py-4">無記錄</p>}
        </div>
    </div>
);

const QuickActionModal = ({ student, customScoreItems, onClose, onExecute }) => {
    const [reason, setReason] = useState('');
    const [delta, setDelta] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <div><h3 className="font-bold text-lg">{student.name}</h3><p className="text-xs opacity-80">目前: {student.score} 分</p></div>
                    <button onClick={onClose}><X className="w-6 h-6"/></button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {customScoreItems.map(item => (
                        <button key={item.id} onClick={() => onExecute(item.delta, item.reason)}
                            className={`p-2 rounded border text-center ${item.type === 'plus' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="text-xs text-gray-600">{item.reason}</div>
                            <div className={`font-bold ${item.type === 'plus' ? 'text-green-600' : 'text-red-600'}`}>{item.delta > 0 ? '+' : ''}{item.delta}</div>
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t bg-gray-50">
                    <div className="flex gap-2 mb-2"><input type="text" placeholder="自訂原因" className="flex-1 p-2 border rounded text-sm" value={reason} onChange={e => setReason(e.target.value)} /><input type="number" placeholder="分" className="w-16 p-2 border rounded text-sm" value={delta} onChange={e => setDelta(e.target.value)} /></div>
                    <button className="w-full bg-indigo-600 text-white py-2 rounded font-bold disabled:opacity-50" disabled={!delta} onClick={() => onExecute(parseInt(delta), reason || '手動')}>確認</button>
                </div>
            </div>
        </div>
    );
};

const GroupEditModal = ({ group, activeStudents, currentGroupStudents, setCurrentGroupStudents, onClose, onSave }) => {
    const isMember = (id) => currentGroupStudents.includes(id);
    const toggle = (id) => setCurrentGroupStudents(prev => isMember(id) ? prev.filter(m => m !== id) : [...prev, id]);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md p-6 h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">編輯: {group.name}</h3><button onClick={onClose}><X className="w-6 h-6"/></button></div>
                <p className="text-sm text-gray-500 mb-2">請勾選屬於此群組的學生（學生可屬於多個群組）。</p>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {activeStudents.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true})).map(s => (
                        <div key={s.id} onClick={() => toggle(s.id)} className={`p-3 rounded border flex justify-between cursor-pointer ${isMember(s.id) ? 'bg-indigo-100 border-indigo-500' : 'bg-white'}`}>
                            <span>{s.name}</span>{isMember(s.id) && <CheckCircle className="w-5 h-5 text-indigo-600"/>}
                        </div>
                    ))}
                </div>
                <button className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-bold" onClick={onSave}>儲存 ({currentGroupStudents.length}人)</button>
            </div>
        </div>
    );
};

// --- Undo Toast Component (Updated with 5s Timer) ---
const UndoToast = ({ lastAction, onUndo, onClose }) => {
    useEffect(() => {
        if (lastAction) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000); // 5秒後自動消失
            return () => clearTimeout(timer);
        }
    }, [lastAction, onClose]);

    if (!lastAction) return null;
    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white pl-6 pr-4 py-3 rounded-full shadow-2xl flex items-center z-50 animate-bounce-small transition-opacity duration-500">
            <span className="text-sm mr-4">已執行：{lastAction.type} {lastAction.reason}</span>
            <button onClick={onUndo} className="flex items-center text-yellow-400 font-bold hover:text-yellow-300 mr-4">
                <RotateCcw className="w-4 h-4 mr-1"/> 復原
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white border-l border-gray-700 pl-3">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// --- Class Selection Component ---
const ClassSelection = ({ classes, onCreateClass, onSelectClass, newClassName, setNewClassName }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-8 flex items-center"><School className="w-10 h-10 mr-3 text-indigo-600"/> 選擇班級</h1>
        
        <div className="w-full max-w-md space-y-4">
            {classes.map(cls => (
                <button 
                    key={cls.id} 
                    onClick={() => onSelectClass(cls)}
                    className="w-full p-6 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border border-gray-100 text-left flex justify-between items-center group"
                >
                    <span className="text-xl font-bold text-gray-700 group-hover:text-indigo-600">{cls.name}</span>
                    <ArrowLeft className="w-6 h-6 text-indigo-400 opacity-0 group-hover:opacity-100 transform rotate-180 transition-all"/>
                </button>
            ))}
            
            {classes.length === 0 && <p className="text-center text-gray-500">尚無班級，請建立一個。</p>}

            <div className="mt-8 pt-8 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-600 mb-2">建立新班級</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="例如：一年五班" 
                        className="flex-1 p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && onCreateClass()}
                    />
                    <button 
                        onClick={onCreateClass}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
                        disabled={!newClassName.trim()}
                    >
                        建立
                    </button>
                </div>
            </div>
        </div>
    </div>
);


// --- The Main App Component ---
const App = () => {
    // Auth & Init
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null); // Add auth state
    const [user, setUser] = useState(null); // Add user object state
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Class State
    const [classes, setClasses] = useState([]);
    const [currentClass, setCurrentClass] = useState(null); 
    const [newClassName, setNewClassName] = useState('');

    // Data State 
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [scoreHistory, setScoreHistory] = useState([]);
    const [customScoreItems, setCustomScoreItems] = useState([]);
    const [redeemItems, setRedeemItems] = useState([]);

    // UI State
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(''); 
    const [activeTab, setActiveTab] = useState('score');
    const [actingStudent, setActingStudent] = useState(null);
    const [scoreDelta, setScoreDelta] = useState(5);
    const [scoreReason, setScoreReason] = useState('良好表現');
    const [isGroupAction, setIsGroupAction] = useState(false);
    const [sortMethod, setSortMethod] = useState('number'); 

    // Undo State
    const [lastAction, setLastAction] = useState(null); 

    // Form Inputs
    const [newStudentName, setNewStudentName] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [currentGroupStudents, setCurrentGroupStudents] = useState([]);
    const [isEditingGroup, setIsEditingGroup] = useState(false);
    const [redeemNote, setRedeemNote] = useState('');

    // --- Refs Helpers ---
    const getClassCollectionRef = (cdb, cuid) => cdb && cuid ? collection(cdb, `/artifacts/${appId}/users/${cuid}/classes`) : null;
    const getClassRef = (cdb, cuid, cid) => cdb && cuid && cid ? doc(cdb, `/artifacts/${appId}/users/${cuid}/classes/${cid}`) : null;
    const getStudentColRef = (cdb, cuid, cid) => cdb && cuid && cid ? collection(cdb, `/artifacts/${appId}/users/${cuid}/classes/${cid}/students`) : null;
    const getHistoryColRef = (cdb, cuid, cid) => cdb && cuid && cid ? collection(cdb, `/artifacts/${appId}/users/${cuid}/classes/${cid}/history`) : null;
    const getGroupDocRef = (cdb, cuid, cid) => cdb && cuid && cid ? doc(cdb, `/artifacts/${appId}/users/${cuid}/classes/${cid}/config/groups`) : null;
    const getScoreItemsRef = (cdb, cuid, cid) => cdb && cuid && cid ? doc(cdb, `/artifacts/${appId}/users/${cuid}/classes/${cid}/config/scoreItems`) : null;
    const getRedeemItemsRef = (cdb, cuid, cid) => cdb && cuid && cid ? doc(cdb, `/artifacts/${appId}/users/${cuid}/classes/${cid}/config/redeemItems`) : null;


    // --- 1. Auth & Init ---
    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const firestore = getFirestore(app);
        setAuth(authInstance);
        setDb(firestore);

        const unsubAuth = onAuthStateChanged(authInstance, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setUserId(currentUser.uid);
                setIsAuthReady(true);
            } else {
                if (initialAuthToken) {
                    try {
                        await signInWithCustomToken(authInstance, initialAuthToken);
                    } catch (e) {
                        console.error("Custom token login failed", e);
                        await signInAnonymously(authInstance);
                    }
                } else {
                    await signInAnonymously(authInstance);
                }
            }
        });
        return () => unsubAuth();
    }, []);

    // --- Google Login Handler ---
    const handleGoogleLogin = async () => {
        if (!auth) return;
        const provider = new GoogleAuthProvider();
        // Remove this line: provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await signInWithPopup(auth, provider);
            setCurrentClass(null); 
        } catch (error) {
            console.error("Login failed:", error);
            alert("登入失敗，請稍後再試。");
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setCurrentClass(null);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    // Listen to Classes
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;
        const q = query(getClassCollectionRef(db, userId));
        return onSnapshot(q, (snap) => {
            setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [isAuthReady, db, userId]);

    // --- 2. Listen to Class Data ---
    useEffect(() => {
        if (!currentClass || !db || !userId) return;
        const cid = currentClass.id;
        setStudents([]); setGroups([]); setScoreHistory([]); setSelectedStudents([]); setIsGroupAction(false); setLastAction(null);

        const unsubscribes = [];
        unsubscribes.push(onSnapshot(query(getStudentColRef(db, userId, cid)), snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubscribes.push(onSnapshot(getGroupDocRef(db, userId, cid), docSnap => {
            if (docSnap.exists()) setGroups(docSnap.data().list || []);
            else setDoc(getGroupDocRef(db, userId, cid), { list: [] }, { merge: true });
        }));
        unsubscribes.push(onSnapshot(getScoreItemsRef(db, userId, cid), docSnap => {
            if (docSnap.exists()) setCustomScoreItems(docSnap.data().items || []);
            else setDoc(getScoreItemsRef(db, userId, cid), { items: [{ id: '1', reason: '良好表現', delta: 1, type: 'plus' }, { id: '2', reason: '發表意見', delta: 1, type: 'plus' }, { id: '3', reason: '未帶作業', delta: -1, type: 'minus' }]}, { merge: true });
        }));
        unsubscribes.push(onSnapshot(getRedeemItemsRef(db, userId, cid), docSnap => {
            if (docSnap.exists()) setRedeemItems(docSnap.data().items || []);
            else setDoc(getRedeemItemsRef(db, userId, cid), { items: [{ id: 'r1', item: '小禮物', cost: 10 }]}, { merge: true });
        }));
        unsubscribes.push(onSnapshot(query(getHistoryColRef(db, userId, cid)), snap => setScoreHistory(snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate() || new Date() })).sort((a,b) => b.timestamp - a.timestamp))));
        
        return () => unsubscribes.forEach(u => u());
    }, [currentClass, db, userId]);


    // --- Actions ---

    const createClass = async () => {
        if (!newClassName.trim()) return;
        await setDoc(doc(getClassCollectionRef(db, userId)), { name: newClassName.trim(), createdAt: new Date() });
        setNewClassName('');
    };
    const deleteClass = async () => {
        if(!currentClass) return;
        await deleteDoc(getClassRef(db, userId, currentClass.id));
        setCurrentClass(null);
    };

    const addStudent = async () => {
        if (!newStudentName.trim()) return;
        await setDoc(doc(getStudentColRef(db, userId, currentClass.id)), { name: newStudentName.trim(), score: 0, groupIds: [], createdAt: new Date() });
        setNewStudentName('');
    };
    const deleteStudent = async (sid) => {
        await updateDoc(doc(getStudentColRef(db, userId, currentClass.id), sid), { isDeleted: true });
    };
    const resetAllScores = async () => {
        try {
            const cid = currentClass.id;
            const active = students.filter(s => !s.isDeleted);
            if(active.length === 0) return alert('無學生可歸零');

            const batch = writeBatch(db);
            active.forEach(s => {
                batch.update(doc(getStudentColRef(db, userId, cid), s.id), { score: 0 });
            });
            const historyRef = doc(getHistoryColRef(db, userId, cid));
            batch.set(historyRef, { type: '歸零', delta: 0, reason: '全班歸零', targets: ['全體'], targetIds: [], actionType: '系統', timestamp: new Date() });
            await batch.commit();
            setLastAction(null); 
            alert('全班分數已成功歸零。');
        } catch (err) {
            console.error(err);
            alert('歸零失敗，請稍後再試。');
        }
    };

    // Group CRUD
    const addGroup = async () => {
        if(!newGroupName.trim()) return;
        const newG = { id: Date.now().toString(), name: newGroupName.trim(), members: [] };
        await updateDoc(getGroupDocRef(db, userId, currentClass.id), { list: arrayUnion(newG) });
        setNewGroupName('');
    };
    const deleteGroup = async (groupId) => {
        const cid = currentClass.id;
        const updatedGroups = groups.filter(g => g.id !== groupId);
        await updateDoc(getGroupDocRef(db, userId, cid), { list: updatedGroups });
        
        const affectedStudents = students.filter(s => (s.groupIds || []).includes(groupId));
        const batchPromises = affectedStudents.map(s => updateDoc(doc(getStudentColRef(db, userId, cid), s.id), {
            groupIds: arrayRemove(groupId)
        }));
        await Promise.all(batchPromises);
    };
    const renameGroup = async (groupId, newName) => {
        const cid = currentClass.id;
        const updatedGroups = groups.map(g => g.id === groupId ? { ...g, name: newName } : g);
        await updateDoc(getGroupDocRef(db, userId, cid), { list: updatedGroups });
    };

    const updateGroupMembers = async () => {
        if (!isEditingGroup) return;
        const cid = currentClass.id;
        const gid = isEditingGroup.id;
        const studentRef = (sid) => doc(getStudentColRef(db, userId, cid), sid);
        
        const active = students.filter(s => !s.isDeleted);
        const batchPromises = active.map(s => {
            if (currentGroupStudents.includes(s.id)) {
                return updateDoc(studentRef(s.id), { groupIds: arrayUnion(gid) });
            } else {
                return updateDoc(studentRef(s.id), { groupIds: arrayRemove(gid) });
            }
        });

        const newGroups = groups.map(g => g.id === gid ? { ...g, members: currentGroupStudents } : g);
        batchPromises.push(updateDoc(getGroupDocRef(db, userId, cid), { list: newGroups }));

        await Promise.all(batchPromises);
        setIsEditingGroup(false);
    };

    const handleScoreUpdate = async (targetStudents, delta, reason, typeLabel, isUndo = false) => {
        if(targetStudents.length === 0) return;
        const cid = currentClass.id;
        
        const batch = targetStudents.map(s => updateDoc(doc(getStudentColRef(db, userId, cid), s.id), { score: s.score + delta }));
        
        if (!isUndo) {
            batch.push(setDoc(doc(getHistoryColRef(db, userId, cid)), {
                type: delta > 0 ? '加分' : '減分', delta, reason, 
                targets: targetStudents.map(s => s.name), targetIds: targetStudents.map(s => s.id),
                actionType: typeLabel, timestamp: new Date()
            }));
            setLastAction({
                type: 'score',
                targetIds: targetStudents.map(s => s.id),
                delta: delta,
                reason: reason
            });
        } else {
             batch.push(setDoc(doc(getHistoryColRef(db, userId, cid)), {
                type: '復原', delta, reason: `復原: ${reason}`, 
                targets: targetStudents.map(s => s.name), targetIds: targetStudents.map(s => s.id),
                actionType: '系統', timestamp: new Date()
            }));
        }
        
        await Promise.all(batch);
        return true;
    };

    const deleteHistoryItem = async (historyItem) => {
        if (!window.confirm('確定要刪除此紀錄並復原分數變更嗎？')) return;
        
        try {
            const cid = currentClass.id;
            const batch = writeBatch(db);

            historyItem.targetIds.forEach(sid => {
                const student = students.find(s => s.id === sid);
                if (student) {
                     const studentRef = doc(getStudentColRef(db, userId, cid), sid);
                     batch.update(studentRef, { score: student.score - historyItem.delta });
                }
            });

            const historyRef = doc(getHistoryColRef(db, userId, cid), historyItem.id);
            batch.delete(historyRef);

            await batch.commit();
        } catch (error) {
            console.error("Error deleting history item:", error);
            alert("刪除失敗，請稍後再試。");
        }
    };

    const executeBatch = async () => {
        let targets = [];
        let label = '';
        
        if (isGroupAction && selectedGroup) {
            const grp = groups.find(g => g.id === selectedGroup);
            if (grp) {
                targets = students.filter(s => ((s.groupIds || []).includes(selectedGroup) || s.groupId === selectedGroup) && !s.isDeleted);
                label = `組別: ${grp.name}`;
            }
        } else {
            targets = students.filter(s => selectedStudents.includes(s.id) && !s.isDeleted);
            label = '選取學生';
        }
        
        if (await handleScoreUpdate(targets, scoreDelta, scoreReason, label)) {
            setSelectedStudents([]); 
        }
    };

    const executeRedeem = async (item, student) => {
        const cid = currentClass.id;
        await updateDoc(doc(getStudentColRef(db, userId, cid), student.id), { score: student.score - item.cost });
        await setDoc(doc(getHistoryColRef(db, userId, cid)), {
            type: '兌換', delta: -item.cost, reason: item.item, note: redeemNote,
            targets: [student.name], targetIds: [student.id], actionType: '個人', timestamp: new Date()
        });
        setLastAction({
            type: 'redeem',
            targetIds: [student.id],
            delta: -item.cost,
            reason: item.item
        });
        setRedeemNote('');
        alert(`兌換成功: ${student.name} - ${item.item}`);
    };

    const handleUndo = async () => {
        if (!lastAction) return;
        const { targetIds, delta, reason } = lastAction;
        
        const currentTargets = students.filter(s => targetIds.includes(s.id));
        
        if (currentTargets.length === 0) {
            alert("找不到該次操作的學生，無法復原。");
            setLastAction(null);
            return;
        }

        await handleScoreUpdate(currentTargets, -delta, reason, '復原', true);
        setLastAction(null);
    };

    const saveScoreItem = async (r, d, t, id) => {
        const items = id ? customScoreItems.map(i => i.id === id ? {id, reason:r, delta:d, type:t} : i) : [...customScoreItems, {id: Date.now().toString(), reason:r, delta:d, type:t}];
        await updateDoc(getScoreItemsRef(db, userId, currentClass.id), { items });
    };
    const delScoreItem = async (id) => { await updateDoc(getScoreItemsRef(db, userId, currentClass.id), { items: customScoreItems.filter(i => i.id !== id) }); };
    const saveRedeemItem = async (n, c, id) => {
        const items = id ? redeemItems.map(i => i.id === id ? {id, item:n, cost:c} : i) : [...redeemItems, {id: Date.now().toString(), item:n, cost:c}];
        await updateDoc(getRedeemItemsRef(db, userId, currentClass.id), { items });
    };
    const delRedeemItem = async (id) => { await updateDoc(getRedeemItemsRef(db, userId, currentClass.id), { items: redeemItems.filter(i => i.id !== id) }); };

    const exportCSV = (data, name) => {
        if(!data.length) return alert('無資料');
        const isHist = data[0].timestamp;
        const head = isHist ? ['時間,類型,分數,原因,對象,備註'] : ['姓名,分數,組別'];
        const rows = data.map(d => isHist 
            ? `${d.timestamp.toLocaleString()},${d.type},${d.delta},${d.reason},"${d.targets.join(' ')}",${d.note||''}`
            : `${d.name},${d.score},${groups.filter(g => (d.groupIds||[]).includes(g.id)).map(g=>g.name).join(';')}`
        );
        const blob = new Blob(["\uFEFF" + [head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${name}.csv`;
        link.click();
    };

    const activeStudents = useMemo(() => students.filter(s => !s.isDeleted), [students]);
    const sortedStudents = useMemo(() => {
        const list = [...activeStudents];
        if (sortMethod === 'score') return list.sort((a, b) => b.score - a.score);
        return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant-TW', { numeric: true }));
    }, [activeStudents, sortMethod]);
    const totalScore = useMemo(() => activeStudents.reduce((sum, s) => sum + s.score, 0), [activeStudents]);

    if (!isAuthReady) return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin text-indigo-600"/></div>;
    if (!currentClass) return <ClassSelection classes={classes} onCreateClass={createClass} onSelectClass={setCurrentClass} newClassName={newClassName} setNewClassName={setNewClassName} />;

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-16">
            <div className="bg-white shadow-sm sticky top-0 z-20">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => setCurrentClass(null)} className="flex items-center text-gray-500 hover:text-indigo-600">
                        <ArrowLeft className="w-5 h-5 mr-1"/> 返回班級列表
                    </button>
                    <h1 className="font-bold text-lg text-gray-800 truncate hidden sm:block">{currentClass.name} 經營系統</h1>
                    <div className="w-8"></div>
                </div>
            </div>

            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Sidebar */}
                    <div className="lg:w-1/3 space-y-6">
                        <ScoreDisplay totalScore={totalScore} studentCount={activeStudents.length} userId={userId} className={currentClass.name} />
                        
                        <nav className="flex space-x-1 p-1 bg-white rounded-xl shadow border border-gray-100 overflow-x-auto">
                            <TabButton tab="score" current={activeTab} setActive={setActiveTab}>加減分</TabButton>
                            <TabButton tab="redeem" current={activeTab} setActive={setActiveTab}>兌換</TabButton>
                            <TabButton tab="setup" current={activeTab} setActive={setActiveTab}>設置</TabButton>
                            <TabButton tab="history" current={activeTab} setActive={setActiveTab}>記錄</TabButton>
                        </nav>

                        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                            {activeTab === 'score' && (
                                <StudentActionPanel 
                                    isGroupAction={isGroupAction} setIsGroupAction={setIsGroupAction}
                                    selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
                                    selectedStudents={selectedStudents} setSelectedStudents={setSelectedStudents}
                                    activeStudents={activeStudents} groups={groups}
                                    customScoreItems={customScoreItems}
                                    scoreReason={scoreReason} setScoreReason={setScoreReason}
                                    scoreDelta={scoreDelta} setScoreDelta={setScoreDelta}
                                    executeBatchScoreAction={executeBatch}
                                />
                            )}
                            {activeTab === 'redeem' && <RedeemPanel redeemItems={redeemItems} selectedStudents={selectedStudents} activeStudents={activeStudents} executeRedeem={executeRedeem} sortedStudents={sortedStudents} setSelectedStudents={setSelectedStudents} redeemNote={redeemNote} setRedeemNote={setRedeemNote} />}
                        </div>
                    </div>

                    {/* Right Content */}
                    <div className="lg:w-2/3">
                        {(activeTab === 'score' || activeTab === 'redeem') && (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                        學生列表
                                        <span className="ml-3 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                            {sortMethod === 'number' ? '排序：座號/姓名' : '排序：分數高低'}
                                        </span>
                                    </h2>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setSortMethod(prev => prev === 'number' ? 'score' : 'number')}
                                            className="flex items-center text-sm bg-white border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <ArrowUpDown className="w-4 h-4 mr-2 text-gray-500"/>
                                            切換排序
                                        </button>
                                        <button className="text-sm bg-indigo-100 text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-200" onClick={() => exportCSV(sortedStudents, 'scores')}>
                                            匯出 CSV
                                        </button>
                                    </div>
                                </div>
                                
                                {/* 學生列表排版優化：High Density Grid (Responsive) */}
                                <div className="grid grid-cols-2 min-[450px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 max-h-[80vh] overflow-y-auto p-1">
                                    {sortedStudents.map(student => (
                                        <StudentCard 
                                            key={student.id} 
                                            student={student} 
                                            groups={groups}
                                            isSelected={selectedStudents.includes(student.id)}
                                            isGroupAction={isGroupAction}
                                            handleSelection={(sid) => {
                                                if(selectedStudents.includes(sid)) setSelectedStudents(prev => prev.filter(id => id !== sid));
                                                else setSelectedStudents(prev => [...prev, sid]);
                                            }}
                                            setActingStudent={setActingStudent}
                                        />
                                    ))}
                                    {sortedStudents.length === 0 && <div className="col-span-full text-center py-10 text-gray-400">尚無學生資料，請至「設置」新增。</div>}
                                </div>
                            </>
                        )}

                        {activeTab === 'setup' && <SetupPanel 
                            newStudentName={newStudentName} setNewStudentName={setNewStudentName} addStudent={addStudent}
                            activeStudents={activeStudents} deleteStudent={deleteStudent}
                            newGroupName={newGroupName} setNewGroupName={setNewGroupName} addGroup={addGroup}
                            groups={groups} setIsEditingGroup={setIsEditingGroup} setCurrentGroupStudents={setCurrentGroupStudents} deleteGroup={deleteGroup} renameGroup={renameGroup}
                            customScoreItems={customScoreItems} handleSaveScoreItem={saveScoreItem} handleDeleteScoreItem={delScoreItem}
                            redeemItems={redeemItems} handleSaveRedeemItem={saveRedeemItem} handleDeleteRedeemItem={delRedeemItem}
                            deleteClass={deleteClass} currentClass={currentClass} resetAllScores={resetAllScores}
                            user={user} handleGoogleLogin={handleGoogleLogin} handleLogout={handleLogout}
                        />}
                        {/* 修正點：將 deleteHistoryItem 傳遞給 HistoryPanel */}
                        {activeTab === 'history' && <HistoryPanel scoreHistory={scoreHistory} exportToCSV={exportCSV} onDelete={deleteHistoryItem} />}
                    </div>
                </div>
            </div>

            <UndoToast lastAction={lastAction} onUndo={handleUndo} onClose={() => setLastAction(null)} />
            {isEditingGroup && <GroupEditModal group={isEditingGroup} activeStudents={activeStudents} currentGroupStudents={currentGroupStudents} setCurrentGroupStudents={setCurrentGroupStudents} onClose={() => { setIsEditingGroup(false); setCurrentGroupStudents([]); }} onSave={updateGroupMembers} />}
            {actingStudent && <QuickActionModal student={actingStudent} customScoreItems={customScoreItems} onClose={() => setActingStudent(null)} onExecute={async (d, r) => { await handleScoreUpdate([actingStudent], d, r, '快速'); setActingStudent(null); }} />}
        </div>
    );
};

export default App;