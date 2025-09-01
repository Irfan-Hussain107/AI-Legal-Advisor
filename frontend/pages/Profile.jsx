import React, { useState } from 'react';

const ProfilePage = () => {
  const [files, setFiles] = useState([
    { id: 1, name: 'Service_Agreement_v1.docx', date: '2024-08-15' },
    { id: 2, name: 'NDA_Client_Project.pdf', date: '2024-08-20' },
    { id: 3, name: 'Lease_Agreement_Final.docx', date: '2024-08-25' }
  ]);

  const handleDelete = (fileIdToDelete) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      setFiles(files.filter(file => file.id !== fileIdToDelete));
    }
  };

  return (
    <section className="page animated-content">
      <div className="container">
        <h2>Past Uploads</h2>
        {files.length > 0 ? (
          <ul className="file-list">
            {files.map(file => (
              <li key={file.id} className="animated-card-item file-item">
                <span className="file-name">{file.name}</span>
                <span className="file-date">{file.date}</span>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(file.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center">
            <p>No files uploaded yet.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProfilePage;