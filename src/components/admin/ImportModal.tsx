import React, { useState, useRef, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/config';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; value: any; message: string }>;
  duplicates: Array<{ row: number; existing: string }>;
  message: string;
}

interface PreviewData {
  headers: string[];
  rows: string[][];
  valid: boolean;
  csvContent: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      alert('Per favore seleziona un file CSV');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
      alert('Il file è troppo grande. Limite massimo: 5MB');
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      generatePreview(content);
    };
    reader.readAsText(selectedFile);
  };

  const generatePreview = (csvContent: string) => {
    try {
      const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
      
      if (lines.length < 2) {
        setPreviewData({
          headers: [],
          rows: [],
          valid: false,
          csvContent
        });
        return;
      }

      const headers = lines[0].split(';').map(col => col.trim());
      const previewRows = lines.slice(1, 6).map(line => 
        line.split(';').map(cell => cell.trim())
      );

      // Validate required columns
      const requiredColumns = ['iniziali', 'pratica', 'ufficio', 'rg', 'tipo atto', 'data udienza'];
      const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
      const hasAllRequired = requiredColumns.every(col => 
        normalizedHeaders.includes(col) || normalizedHeaders.includes(col.replace(' ', '_'))
      );

      setPreviewData({
        headers,
        rows: previewRows,
        valid: hasAllRequired,
        csvContent
      });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setPreviewData({
        headers: [],
        rows: [],
        valid: false,
        csvContent
      });
    }
  };

  const handleImport = async () => {
    if (!previewData?.csvContent) return;

    setImporting(true);
    try {
      const importDataFn = httpsCallable(functions, 'importData');
      const result = await importDataFn({
        csvContent: previewData.csvContent,
        skipDuplicates
      });

      setImportResult(result.data as ImportResult);
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Errore durante l\'importazione dei dati');
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setPreviewData(null);
    setImportResult(null);
    setDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">Importa Dati da CSV</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!importResult && (
          <>
            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center ${
                dragActive
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-2">
                  <div className="text-green-600">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600">File selezionato: {file.name}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetModal();
                    }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Rimuovi file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600">
                    Trascina qui il tuo file CSV o clicca per selezionarlo
                  </p>
                  <p className="text-sm text-gray-500">
                    File CSV con delimitatore punto e virgola (;) - Max 5MB
                  </p>
                </div>
              )}
            </div>

            {/* Format Instructions */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Formato file CSV richiesto:</h4>
              <div className="text-sm text-blue-800">
                <p className="mb-1">• Delimitatore: punto e virgola (;)</p>
                <p className="mb-1">• Colonne obbligatorie: Iniziali, Pratica, Ufficio, RG, Tipo Atto, Data Udienza</p>
                <p className="mb-1">• Colonne opzionali: Foro, Stato, Data Stato, Note, Archiviato</p>
                <p className="mb-1">• Formato date: DD/MM/YYYY (es. 15/06/2025)</p>
                <p>• Formato RG: numero/anno (es. 506/2025)</p>
              </div>
            </div>

            {/* Preview */}
            {previewData && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Anteprima dati</h4>
                
                {!previewData.valid && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-800 text-sm">
                      ⚠️ Il file non contiene tutte le colonne obbligatorie richieste.
                    </p>
                  </div>
                )}

                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {previewData.headers.map((header, index) => (
                          <th
                            key={index}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewData.rows.length < 5 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Mostrate solo le prime 5 righe per anteprima
                  </p>
                )}

                {/* Import Options */}
                <div className="mt-4 flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      id="skipDuplicates"
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="skipDuplicates" className="ml-2 block text-sm text-gray-700">
                      Salta record duplicati
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Annulla
              </button>
              {previewData && (
                <button
                  onClick={handleImport}
                  disabled={importing || !previewData.valid}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                >
                  {importing ? 'Importazione...' : 'Importa Dati'}
                </button>
              )}
            </div>
          </>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${
              importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <h4 className={`font-medium ${
                importResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {importResult.success ? '✅ Import Completato' : '❌ Import Fallito'}
              </h4>
              <p className={`text-sm mt-1 ${
                importResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {importResult.message}
              </p>
            </div>

            {importResult.success && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-100 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                  <div className="text-sm text-green-800">Importati</div>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                  <div className="text-sm text-yellow-800">Duplicati</div>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                  <div className="text-sm text-red-800">Errori</div>
                </div>
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-red-800 mb-2">Errori di validazione:</h5>
                <div className="max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded p-3">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700 mb-1">
                      Riga {error.row}: {error.message} ({error.field}: "{error.value}")
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.duplicates.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-yellow-800 mb-2">Record duplicati trovati:</h5>
                <div className="max-h-40 overflow-y-auto bg-yellow-50 border border-yellow-200 rounded p-3">
                  {importResult.duplicates.map((duplicate, index) => (
                    <div key={index} className="text-sm text-yellow-700 mb-1">
                      Riga {duplicate.row}: duplicato di record esistente {duplicate.existing}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setImportResult(null);
                  setPreviewData(null);
                  setFile(null);
                }}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Importa Altro File
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Chiudi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};