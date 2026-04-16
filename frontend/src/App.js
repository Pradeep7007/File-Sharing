import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [fileId, setFileId] = useState(null);
  const [view, setView] = useState('upload'); // 'upload' or 'download'
  
  // Gallery States
  const [filesList, setFilesList] = useState([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  
  // Upload States
  const [selectedFile, setSelectedFile] = useState(null);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedLink, setUploadedLink] = useState('');
  const [error, setError] = useState('');

  // Download States
  const [fileInfo, setFileInfo] = useState(null);
  const [dlPassword, setDlPassword] = useState('');
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [dlError, setDlError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      setFileId(id);
      setView('download');
      fetchFileInfo(id);
    } else {
      fetchFiles();
    }
  }, []);

  const fetchFiles = async () => {
    setIsFilesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/files`);
      const data = await res.json();
      if (res.ok) setFilesList(data);
    } catch (err) {
      console.error('Failed to fetch files');
    } finally {
      setIsFilesLoading(false);
    }
  };

  const fetchFileInfo = async (id) => {
    setIsLoadingInfo(true);
    setDlError('');
    try {
      const res = await fetch(`${API_BASE}/api/info/${id}`);
      const data = await res.json();
      if (res.ok) {
        setFileInfo(data);
      } else {
        setDlError(data.error || 'File not found');
      }
    } catch (err) {
      setDlError('Unable to connect to server');
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024 * 1024) {
        setError('File too large (Max 500MB)');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (password) formData.append('password', password);
    if (expiry) formData.append('expiryHours', expiry);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        setUploadedLink(data.url);
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          setError(data.details ? `${data.error}: ${data.details}` : (data.error || 'Upload failed'));
        } catch (e) {
          setError('Upload failed: Server returned an invalid response');
        }
      }
    });

    xhr.addEventListener('error', () => {
      setIsUploading(false);
      setError('Network error');
    });

    xhr.open('POST', `${API_BASE}/upload`);
    xhr.send(formData);
  };

  const initiateDownload = () => {
    setDlError('');
    setIsDownloading(true);

    let url = `${API_BASE}/download/${fileId}`;
    if (dlPassword) {
      url += `?password=${encodeURIComponent(dlPassword)}`;
    }

    // Using a hidden link to trigger native browser download
    // This is better for large files and ensures the browser's download manager handles it
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileInfo.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // We set a timeout to reset state since we can't easily track native download success
    setTimeout(() => setIsDownloading(false), 2000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(uploadedLink);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="app">
      <div className="blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      <div className="glass-card">
        {view === 'upload' ? (
          <div className="upload-view">
            <h1>DropShare</h1>
            <p className="subtitle">Securely share files with anybody.</p>

            {!uploadedLink ? (
              <>
                <div 
                  className="upload-zone"
                  onClick={() => fileInputRef.current.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{display: 'none'}} 
                    onChange={handleFileChange}
                  />
                  <span className="upload-icon">
                    {selectedFile ? '📄' : '☁️'}
                  </span>
                  <div className="upload-text">
                    {selectedFile ? selectedFile.name : 'Click to select or drag file'}
                  </div>
                  <div className="upload-subtext">
                    {selectedFile ? `${(selectedFile.size / (1024*1024)).toFixed(2)} MB` : 'All files up to 500MB supported'}
                  </div>
                </div>

                {selectedFile && (
                  <div className="controls-group">
                    <div>
                      <label>Set Password (Optional)</label>
                      <input 
                        type="password" 
                        placeholder="Keep it secret"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Auto-expiry (Optional)</label>
                      <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                        <option value="">Never</option>
                        <option value="1">1 Hour</option>
                        <option value="24">24 Hours</option>
                        <option value="168">7 Days</option>
                      </select>
                    </div>

                    {isUploading ? (
                      <div className="progress-container">
                        <div className="progress-track">
                          <div className="progress-bar" style={{width: `${uploadProgress}%`}}></div>
                        </div>
                        <div className="progress-info">
                          <span>{uploadProgress === 100 ? 'Finalizing...' : 'Uploading...'}</span>
                          <span>{uploadProgress}%</span>
                        </div>
                      </div>
                    ) : (
                      <button className="btn-primary" onClick={uploadFile}>
                        Share File
                      </button>
                    )}

                    {error && <div className="error-box" style={{marginTop: '1rem'}}>{error}</div>}
                  </div>
                )}
              </>
            ) : (
              <div className="result-card">
                <div style={{fontSize: '2rem', marginBottom: '1rem'}}>✅</div>
                <h2 style={{marginBottom: '0.5rem'}}>File Ready!</h2>
                <p style={{color: 'var(--text-secondary)'}}>Share this link with your recipient:</p>
                <div className="link-group">
                  <input className="link-input" value={uploadedLink} readOnly />
                  <button className="btn-copy" onClick={copyToClipboard}>Copy</button>
                </div>
                <button 
                  className="btn-primary" 
                  style={{marginTop: '2rem', width: '100%'}}
                  onClick={() => {
                    setUploadedLink('');
                    setSelectedFile(null);
                    setPassword('');
                    setExpiry('');
                    fetchFiles();
                  }}
                >
                  Upload Another
                </button>
              </div>
            )}

            {/* Gallery Section */}
            {!uploadedLink && !isUploading && (
              <div className="gallery-section">
                <h2 style={{fontSize: '1.5rem', marginBottom: '1rem'}}>Available Files</h2>
                {isFilesLoading ? (
                  <p>Searching for files...</p>
                ) : filesList.length === 0 ? (
                  <p style={{color: 'var(--text-secondary)'}}>No shared files yet.</p>
                ) : (
                  <div className="gallery-grid">
                    {filesList.map(f => (
                      <div key={f.fileId} className="file-card" onClick={() => window.location.href = `/?id=${f.fileId}`}>
                        <span className="card-icon">📄</span>
                        <div className="card-name">{f.filename}</div>
                        <div className="card-date">{new Date(f.uploadTime).toLocaleDateString()}</div>
                        {f.requiresPassword && <div className="password-badge">🔒 Protected</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="download-view">
            <h1>DropShare</h1>
            <p className="subtitle">Secure retrieval.</p>

            {isLoadingInfo ? (
              <p>Fetching file details...</p>
            ) : dlError ? (
              <div className="error-box">
                <div style={{fontSize: '3rem', marginBottom: '1rem'}}>⚠️</div>
                <p>{dlError}</p>
                <button className="btn-primary" onClick={() => window.location.href = '/'} style={{marginTop: '1.5rem', width: '100%'}}>
                  Go Home
                </button>
              </div>
            ) : fileInfo ? (
              <>
                <div className="file-icon">📦</div>
                <div className="filename">{fileInfo.filename}</div>
                <div className="meta-info">
                  Uploaded {new Date(fileInfo.uploadTime).toLocaleDateString()}
                </div>

                {fileInfo.requiresPassword && (
                  <div style={{textAlign: 'left', marginBottom: '1.5rem'}}>
                    <label>This file is protected</label>
                    <input 
                      type="password" 
                      placeholder="Enter decryption password"
                      value={dlPassword}
                      onChange={(e) => setDlPassword(e.target.value)}
                    />
                  </div>
                )}

                <button 
                  className="btn-primary" 
                  style={{width: '100%'}}
                  onClick={initiateDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? 'Downloading...' : 'Download File'}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;