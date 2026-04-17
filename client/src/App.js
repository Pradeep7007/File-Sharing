import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Upload, 
  File as FileIcon, 
  Download, 
  Trash2, 
  Copy, 
  Check, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Key,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const API_BASE_URL = 'http://localhost:5000';

function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [password, setPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null); 
  const [deletePassword, setDeletePassword] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !password) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('password', password);

    try {
      await axios.post(`${API_BASE_URL}/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      
      setSelectedFile(null);
      setPassword('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles();
    } catch (error) {
      alert(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/delete/${showDeleteModal}`, {
        data: { password: deletePassword }
      });
      setShowDeleteModal(null);
      setDeletePassword('');
      fetchFiles();
    } catch (error) {
      alert(error.response?.data?.error || 'Delete failed');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(id);
      setTimeout(() => setCopySuccess(null), 2000);
    });
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return <ImageIcon size={24} />;
    if (type.startsWith('video/')) return <Video size={24} />;
    if (type.includes('pdf') || type.includes('word')) return <FileText size={24} />;
    return <FileIcon size={24} />;
  };

  return (
    <div className="app-wrapper">
      <div className="container">
        <header>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            DropShare
          </motion.h1>
          <motion.p 
            className="subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Secure, fast, and encrypted file sharing made easy.
          </motion.p>
        </header>

        <div className="main-layout">
          <motion.div 
            className="upload-card glass-panel"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <form onSubmit={handleUpload}>
              <div 
                className={`upload-area ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files[0]) {
                    setSelectedFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current.click()}
              >
                <div className="upload-icon">
                  <Upload size={48} />
                </div>
                <h3>{selectedFile ? selectedFile.name : 'Drop file here or click to browse'}</h3>
                <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                  Max file size: 100MB
                </p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              <div className="input-group">
                <label><Key size={14} style={{ marginRight: '5px' }} /> Set Protection Password</label>
                <input 
                  type="password" 
                  placeholder="Enter a secret password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                disabled={uploading || !selectedFile || !password}
              >
                {uploading ? (
                  <span>Uploading {uploadProgress}%</span>
                ) : (
                  <>
                    <Plus size={20} /> Upload Securely
                  </>
                )}
              </button>

              {uploading && (
                <div className="progress-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </form>
          </motion.div>

          <div className="file-list-container">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div 
                  key={file.id}
                  className="file-card glass-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <div className="file-icon-wrapper">
                    {getFileIcon(file.type || '')}
                  </div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      <span>{formatSize(file.size)}</span>
                      <span>•</span>
                      <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="file-actions">
                    <button 
                      className="action-btn" 
                      title="Copy link"
                      onClick={() => copyToClipboard(file.downloadLink, file.id)}
                    >
                      {copySuccess === file.id ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}
                    </button>
                    <a 
                      href={file.downloadLink} 
                      className="action-btn" 
                      title="Download"
                      download
                    >
                      <Download size={18} />
                    </a>
                    <button 
                      className="action-btn delete" 
                      title="Delete"
                      onClick={() => setShowDeleteModal(file.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {files.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <FileIcon size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>No files uploaded yet. Be the first!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <motion.div 
            className="modal-content glass-panel"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3>Delete File?</h3>
            <p style={{ margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Enter the password you set during upload to permanently delete this file.
            </p>
            <div className="input-group">
              <input 
                type="password" 
                placeholder="Password" 
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn-primary" 
                style={{ background: 'var(--danger)', flex: 1 }}
                onClick={handleDelete}
              >
                Delete
              </button>
              <button 
                className="btn-primary" 
                style={{ background: 'rgba(255,255,255,0.1)', flex: 1 }}
                onClick={() => { setShowDeleteModal(null); setDeletePassword(''); }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
