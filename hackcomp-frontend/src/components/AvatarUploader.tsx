import { useRef, useState } from 'react';
import { api } from '../api';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import Avatar from './Avatar';

interface AvatarUploaderProps {
  name?: string | null;
  avatarUrl?: string | null;
  onAvatarChange: (avatarUrl: string | null) => void;
  size?: number;
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const AvatarUploader = ({ name, avatarUrl, onAvatarChange, size = 88 }: AvatarUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState('');

  const handlePick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      setError('Please choose a PNG, JPEG, WebP or GIF image.');
      return;
    }

    setError('');
    setBusy('upload');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.uploadAvatar(formData);
      onAvatarChange(res.data?.avatar_url || null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload profile picture.');
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setError('');
    setBusy('remove');
    try {
      await api.removeAvatar();
      onAvatarChange(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove profile picture.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="avatar-uploader">
      <div className="avatar-uploader-preview">
        <Avatar name={name} avatarUrl={avatarUrl} size={size} />
        {busy && (
          <span className="avatar-uploader-busy">
            <Loader2 size={18} className="spin" />
          </span>
        )}
      </div>

      <div className="avatar-uploader-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handlePick}
          disabled={busy !== null}
        >
          <Camera size={13} />
          {avatarUrl ? 'Update Photo' : 'Add Photo'}
        </button>
        {avatarUrl && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleRemove}
            disabled={busy !== null}
          >
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ fontSize: '11px', padding: '8px 10px' }}>{error}</div>}
    </div>
  );
};

export default AvatarUploader;
