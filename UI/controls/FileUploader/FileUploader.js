// FileUploader.js - Custom Drag & Drop File Uploader

(function() {
    'use strict';

    class FileUploader {
        constructor(container, options = {}) {
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            this.options = {
                accept: options.accept || '*/*',
                title: options.title || 'Click or drag file to this area to upload',
                subtitle: options.subtitle || 'Support for a single file upload.',
                onFileSelect: options.onFileSelect || null,
                ...options
            };
            this.file = null;
            this._init();
        }

        _init() {
            this.element = document.createElement('div');
            this.element.className = 'duck-file-uploader';

            this.icon = document.createElement('span');
            this.icon.className = 'material-symbols-outlined duck-file-uploader-icon';
            this.icon.textContent = 'upload_file';

            this.titleEl = document.createElement('div');
            this.titleEl.className = 'duck-file-uploader-title';
            this.titleEl.textContent = this.options.title;

            this.subtitleEl = document.createElement('div');
            this.subtitleEl.className = 'duck-file-uploader-subtitle';
            this.subtitleEl.textContent = this.options.subtitle;

            this.input = document.createElement('input');
            this.input.type = 'file';
            this.input.className = 'duck-file-uploader-input';
            this.input.accept = this.options.accept;

            this.element.appendChild(this.icon);
            this.element.appendChild(this.titleEl);
            this.element.appendChild(this.subtitleEl);
            this.element.appendChild(this.input);

            this.container.appendChild(this.element);

            this._setupEvents();
        }

        _setupEvents() {
            // Drag Events
            ['dragenter', 'dragover'].forEach(evt => {
                this.element.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.element.classList.add('is-dragover');
                });
            });

            ['dragleave', 'drop'].forEach(evt => {
                this.element.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.element.classList.remove('is-dragover');
                });
            });

            // Drop
            this.element.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    this._handleFile(files[0]);
                }
            });

            // Click -> Input Change
            this.input.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    this._handleFile(files[0]);
                }
            });
        }

        _handleFile(file) {
            // Validate extension if accept is specified
            if (this.options.accept && this.options.accept !== '*/*') {
                const exts = this.options.accept.split(',').map(e => e.trim().toLowerCase());
                const fileExt = '.' + file.name.split('.').pop().toLowerCase();
                if (!exts.includes(fileExt) && !exts.includes(file.type)) {
                    alert(`Invalid file type. Accepted types: ${this.options.accept}`);
                    this.reset();
                    return;
                }
            }

            this.file = file;
            this.element.classList.add('has-file');
            this.icon.textContent = 'description';
            this.titleEl.textContent = file.name;
            
            const sizeKB = (file.size / 1024).toFixed(2);
            this.subtitleEl.textContent = `${sizeKB} KB`;

            if (this.options.onFileSelect) {
                this.options.onFileSelect(file);
            }
        }

        getFile() {
            return this.file;
        }

        reset() {
            this.file = null;
            this.input.value = '';
            this.element.classList.remove('has-file');
            this.icon.textContent = 'upload_file';
            this.titleEl.textContent = this.options.title;
            this.subtitleEl.textContent = this.options.subtitle;
        }
    }

    window.DuckControls = window.DuckControls || {};
    window.DuckControls.FileUploader = {
        create(container, options) {
            return new FileUploader(container, options);
        }
    };
})();
