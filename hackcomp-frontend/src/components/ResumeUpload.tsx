import { Upload, Check } from 'lucide-react';

interface Props {
  file: File | null;
  setFile: (file: File | null) => void;
}

const ResumeUpload: React.FC<Props> = ({ file, setFile }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h3 className="card-title">Upload Resume PDF</h3>
      </div>
      
      <input 
        type="file" 
        accept="application/pdf" 
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="resume-upload"
      />

      <label 
        htmlFor="resume-upload" 
        className={`upload-zone ${file ? 'has-file' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        {file ? (
          <>
            <div style={{ padding: '8px', background: 'var(--primary-muted)', borderRadius: '50%', color: 'var(--primary)' }}>
              <Check size={20} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{file.name}</span>
            <span style={{ fontSize: '11px', color: 'var(--subtle)' }}>{(file.size / 1024).toFixed(1)} KB — Click to change file</span>
          </>
        ) : (
          <>
            <div style={{ padding: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--muted)' }}>
              <Upload size={20} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>Click to browse or drop PDF here</span>
            <span style={{ fontSize: '11px', color: 'var(--subtle)' }}>Maximum file size: 10MB (.pdf)</span>
          </>
        )}
      </label>
    </div>
  );
};

export default ResumeUpload;
