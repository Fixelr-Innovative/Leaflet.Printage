/*
 Leaflet.Printage (https://github.com/fixelr-innovative/Leaflet.Printage).
 (c) 2024, Raj Narayan Gupta, Fixelr Innovative (India)
*/

(function (factory, window) {

    // define an AMD module that relies on 'leaflet'
    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory);

        // define a Common JS module that relies on 'leaflet'
    } else if (typeof exports === 'object') {
        module.exports = factory(require('leaflet'));
    }

    // attach your plugin to the global 'L' variable
    if (typeof window !== 'undefined' && window.L) {
        window.L.YourPlugin = factory(L);
    }
}(function (L) {

    L.Control.Printage = L.Control.extend({
        options: {
            position: 'topright',
            title: 'Get image',
            printControlLabel: '&#128438;',
            printControlClasses: [],
            printControlTitle: 'Get image',
            _unicodeClass: 'polyline-measure-unicode-icon',
            maxScale: 10,
            minScale: 1,
            inputTitle: 'Choose scale:',
            downloadTitle: 'Download'
        },

        onAdd: function (map) {
            this._map = map;

            const title = this.options.printControlTitle;
            const label = this.options.printControlLabel;
            let classes = this.options.printControlClasses;

            if (label.indexOf('&') != -1) classes.push(this.options._unicodeClass);

            return this._createControl(label, title, classes, this._click, this);
        },

        _click: function (e) {
            this._container.classList.add('leaflet-control-layers-expanded');
            this._containerParams.style.display = '';
            this._controlPanel.classList.add('polyline-measure-unicode-icon-disable');
        },

        _createControl: function (label, title, classesToAdd, fn, context) {

            this._container = document.createElement('div');
            this._container.id = 'print-container';
            this._container.classList.add('leaflet-bar');

            this._containerParams = document.createElement('div');
            this._containerParams.id = 'print-params';
            this._containerParams.style.display = 'none';

            this._createCloseButton();

            let containerTitle = document.createElement('h6');
            containerTitle.style.width = '100%';
            containerTitle.innerHTML = this.options.inputTitle;
            this._containerParams.appendChild(containerTitle);

            this._createScaleInput();
            this._createDownloadButton();
            this._container.appendChild(this._containerParams);

            this._createControlPanel(classesToAdd, context, label, title, fn);

            return this._container;
        },

        _createDownloadButton: function () {
            this._downloadBtn = document.createElement('div');
            this._downloadBtn.classList.add('download-button');

            this._downloadBtn = document.createElement('div');
            this._downloadBtn.classList.add('download-button');
            this._downloadBtn.innerHTML = this.options.downloadTitle;

            this._downloadBtn.addEventListener('click', () => {
                let scale_value = this._scaleInput.value;
                if (!scale_value || scale_value < this.options.minScale || scale_value > this.options.maxScale) {
                    this._scaleInput.value = this.options.minScale;
                    return;
                }

                this._containerParams.classList.add('print-disabled');
                this._loader.style.display = 'block';
                this._print();
            });
            this._containerParams.appendChild(this._downloadBtn);
        },

        _createScaleInput: function () {
            this._scaleInput = document.createElement('input');
            this._scaleInput.style.width = '100%';
            this._scaleInput.type = 'number';
            this._scaleInput.value = this.options.minScale;
            this._scaleInput.min = this.options.minScale;
            this._scaleInput.max = this.options.maxScale;
            this._scaleInput.id = 'scale';
            this._containerParams.appendChild(this._scaleInput);

        },

        _createCloseButton: function () {
            let span = document.createElement('div');
            span.classList.add('close');
            span.innerHTML = '&times;';

            span.addEventListener('click', () => {
                this._container.classList.remove('leaflet-control-layers-expanded');
                this._containerParams.style.display = 'none';
                this._controlPanel.classList.remove('polyline-measure-unicode-icon-disable');
            });

            this._containerParams.appendChild(span);
        },

        _createControlPanel: function (classesToAdd, context, label, title, fn) {
            let controlPanel = document.createElement('a');
            controlPanel.innerHTML = label;
            controlPanel.id = 'print-btn';
            controlPanel.setAttribute('title', title);
            classesToAdd.forEach(function (c) {
                controlPanel.classList.add(c);
            });
            L.DomEvent.on(controlPanel, 'click', fn, context);
            this._container.appendChild(controlPanel);
            this._controlPanel = controlPanel;

            this._loader = document.createElement('div');
            this._loader.id = 'print-loading';
            this._container.appendChild(this._loader);
        },

        _getLayers: function (resolve) {
            let self = this;
            let promises = [];
            self._map.eachLayer(function (layer) {
                
                promises.push(new Promise((new_resolve) => {
                    try {
                        if (layer instanceof L.Marker && layer._icon && layer._icon.innerHTML.includes('img')) {
                            debugger;
                            self._getMarkerLayer(layer, new_resolve);
                        }
                        else if (layer instanceof L.Marker && layer._icon && layer._icon.src) {
                            self._getMarkerLayer(layer, new_resolve)
                        } else if (layer instanceof L.TileLayer) {
                            self._getTileLayer(layer, new_resolve);
                        } else if (layer instanceof L.Circle) {
                            if (!self.circles[layer._leaflet_id]) {
                                self.circles[layer._leaflet_id] = layer;
                            }
                            new_resolve();
                        } else if (layer instanceof L.Path) {
                            self._getPathLayer(layer, new_resolve);
                        } else {
                            new_resolve();
                        }
                    } catch (e) {
                        console.log(e);
                        new_resolve();
                    }
                }));
            });

            Promise.all(promises).then(() => {
                resolve()
            });
        },

        _getTileLayer: function (layer, resolve) {
            let self = this;

            self.tiles = [];
            self.tileSize = layer._tileSize.x;
            self.tileBounds = L.bounds(self.bounds.min.divideBy(self.tileSize)._floor(), self.bounds.max.divideBy(self.tileSize)._floor());

            for (let j = self.tileBounds.min.y; j <= self.tileBounds.max.y; j++)
                for (let i = self.tileBounds.min.x; i <= self.tileBounds.max.x; i++)
                    self.tiles.push(new L.Point(i, j));

            let promiseArray = [];
            self.tiles.forEach(tilePoint => {
                let originalTilePoint = tilePoint.clone();
                if (layer._adjustTilePoint) layer._adjustTilePoint(tilePoint);

                let tilePos = originalTilePoint.scaleBy(new L.Point(self.tileSize, self.tileSize)).subtract(self.bounds.min);

                if (tilePoint.y < 0) return;

                promiseArray.push(new Promise(resolve => {
                    self._loadTile(tilePoint, tilePos, layer, resolve);
                }));
            });

            Promise.all(promiseArray).then(() => {
                resolve();
            });
        },

        _loadTile: function (tilePoint, tilePos, layer, resolve) {
            let self = this;
            let imgIndex = tilePoint.x + ':' + tilePoint.y + ':' + self.zoom;
            let image = new Image();
            image.crossOrigin = 'Anonymous';
            image.onload = function () {
                if (!self.tilesImgs[imgIndex]) self.tilesImgs[imgIndex] = {img: image, x: tilePos.x, y: tilePos.y};
                resolve();
            };
            image.src = layer.getTileUrl(tilePoint);
        },

        _getMarkerLayer: function (layer, resolve) {
            let self = this;
            debugger;
            if (self.markers[layer._leaflet_id]) {
                resolve();
                return;
            }

            let pixelPoint = self._map.project(layer._latlng);
            pixelPoint = pixelPoint.subtract(new L.Point(self.bounds.min.x, self.bounds.min.y));

            if (layer.options.icon && layer.options.icon.options && layer.options.icon.options.iconAnchor) {
                pixelPoint.x -= layer.options.icon.options.iconAnchor[0];
                pixelPoint.y -= layer.options.icon.options.iconAnchor[1];
            }

            if (!self._pointPositionIsNotCorrect(pixelPoint)) {
                let image = new Image();
                image.crossOrigin = 'Anonymous';
                image.onload = function () {
                    self.markers[layer._leaflet_id] = {img: image, x: pixelPoint.x, y: pixelPoint.y};
                    resolve();
                };
                if (!layer._icon || !layer._icon.src || layer._icon.src.trim() === "") {
                    // If _icon.src is empty or undefined, look for an img tag inside layer._icon
                    const imgTag = layer._icon.querySelector("img"); // find the <img> tag if it exists
                    if (imgTag && imgTag.src) {
                        image.style.width = "25px";
                        //image.style.position = "fixed";
                        // If an image tag is found, use its src
                        image.src = imgTag.src;
                    } else {
                        // Otherwise, fallback to default image
                        image.src = "/img/marker-icon.png";
                    }
                } else {
                    // If _icon.src is valid, use it
                    image.src = layer._icon.src;
                }
            } else {
                resolve();
            }
        },

        _pointPositionIsNotCorrect: function (point) {
            return (point.x < 0 || point.y < 0 || point.x > this.canvas.width || point.y > this.canvas.height);
        },

        _getPathLayer: function (layer, resolve) {
            let self = this;

            let correct = 0;
            let parts = [];

            if (layer._mRadius || !layer._latlngs) {
                resolve();
                return;
            }

            let latlngs = layer.options.fill ? layer._latlngs[0] : layer._latlngs;
            latlngs.forEach((latLng) => {
                let pixelPoint = self._map.project(latLng);
                pixelPoint = pixelPoint.subtract(new L.Point(self.bounds.min.x, self.bounds.min.y));
                parts.push(pixelPoint);
                if (pixelPoint.x < self.canvas.width && pixelPoint.y < self.canvas.height) correct = 1;
            });

            if (correct) self.path[layer._leaflet_id] = {
                parts: parts,
                closed: layer.options.fill,
                options: layer.options
            };
            resolve();
        },

        _changeScale: function (scale) {
            if (!scale || scale <= 1) return 0;

            let addX = (this.bounds.max.x - this.bounds.min.x) / 2 * (scale - 1);
            let addY = (this.bounds.max.y - this.bounds.min.y) / 2 * (scale - 1);

            this.bounds.min.x -= addX;
            this.bounds.min.y -= addY;
            this.bounds.max.x += addX;
            this.bounds.max.y += addY;

            this.canvas.width *= scale;
            this.canvas.height *= scale;
        },

        _drawPath: function (value) {
            let self = this;

            self.ctx.beginPath();
            let count = 0;
            let options = value.options;
            value.parts.forEach((point) => {
                self.ctx[count++ ? 'lineTo' : 'moveTo'](point.x, point.y);
            });

            if (value.closed) self.ctx.closePath();

            this._feelPath(options);
        },

        _drawCircle: function (layer, resolve) {

            if (layer._empty()) {
                return;
            }

            let point = this._map.project(layer._latlng);
            point = point.subtract(new L.Point(this.bounds.min.x, this.bounds.min.y));

            let r = Math.max(Math.round(layer._radius), 1),
                s = (Math.max(Math.round(layer._radiusY), 1) || r) / r;

            if (s !== 1) {
                this.ctx.save();
                this.scale(1, s);
            }

            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y / s, r, 0, Math.PI * 2, false);

            if (s !== 1) {
                this.ctx.restore();
            }

            this._feelPath(layer.options);
        },

        _feelPath: function (options) {

            if (options.fill) {
                this.ctx.globalAlpha = options.fillOpacity;
                this.ctx.fillStyle = options.fillColor || options.color;
                this.ctx.fill(options.fillRule || 'evenodd');
            }

            if (options.stroke && options.weight !== 0) {
                if (this.ctx.setLineDash) {
                    this.ctx.setLineDash(options && options._dashArray || []);
                }
                this.ctx.globalAlpha = options.opacity;
                this.ctx.lineWidth = options.weight;
                this.ctx.strokeStyle = options.color;
                this.ctx.lineCap = options.lineCap;
                this.ctx.lineJoin = options.lineJoin;
                this.ctx.stroke();
            }
        },

        _print: function () {
            let self = this;

            self.tilesImgs = {};
            self.markers = {};
            self.path = {};
            self.circles = {};

            let dimensions = self._map.getSize();

            self.zoom = self._map.getZoom();
            self.bounds = self._map.getPixelBounds();

            self.canvas = document.createElement('canvas');
            self.canvas.width = dimensions.x;
            self.canvas.height = dimensions.y;
            self.ctx = self.canvas.getContext('2d');

            this._changeScale(document.getElementById('scale').value);

            let promise = new Promise(function (resolve, reject) {
                self._getLayers(resolve);
            });

            promise.then(() => {
                return new Promise(((resolve, reject) => {
                    for (const [key, value] of Object.entries(self.tilesImgs)) {
                        self.ctx.drawImage(value.img, value.x, value.y, self.tileSize, self.tileSize);
                    }
                    for (const [key, value] of Object.entries(self.path)) {
                        self._drawPath(value);
                    }
                    for (const [key, value] of Object.entries(self.markers)) {
                        self.ctx.drawImage(value.img, value.x, value.y);
                    }
                    for (const [key, value] of Object.entries(self.circles)) {
                        self._drawCircle(value);
                    }
                    resolve();
                }));
            }).then(() => {
                self.canvas.toBlob(function (blob) {
                    let link = document.createElement('a');
                    link.download = "my-image.png";
                    link.href = URL.createObjectURL(blob);
                    link.click();
                });
                self._containerParams.classList.remove('print-disabled');
                self._loader.style.display = 'none';
            });
        },
        _manualPrint: function (mysintesi) {
            let self = this;

            self.tilesImgs = {};
            self.markers = {};
            self.path = {};
            self.circles = {};

            let dimensions = self._map.getSize();

            self.zoom = self._map.getZoom();
            self.bounds = self._map.getPixelBounds();

            self.canvas = document.createElement('canvas');
            self.canvas.width = dimensions.x;
            self.canvas.height = dimensions.y;
            self.ctx = self.canvas.getContext('2d');

            this._changeScale(document.getElementById('scale').value);

            let promise = new Promise(function (resolve, reject) {
                self._getLayers(resolve);
            });

            promise.then(() => {
                debugger;
                return new Promise(((resolve, reject) => {
                    for (const [key, value] of Object.entries(self.tilesImgs)) {
                        self.ctx.drawImage(value.img, value.x, value.y, self.tileSize, self.tileSize);
                    }
                    for (const [key, value] of Object.entries(self.path)) {
                        self._drawPath(value);
                    }
                    for (const [key, value] of Object.entries(self.markers)) {
                        self.ctx.drawImage(value.img, value.x, value.y);
                    }
                    for (const [key, value] of Object.entries(self.markers)) {
                        debugger;
                        if (value.icon != undefined) {
                            const svgElement = value.icon.createSvg();
                            const svgBlob = new Blob([svgElement.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
                            const url = URL.createObjectURL(svgBlob);
                            const img = new Image();
                            img.src = url;
                            img.onload = function () {
                                self.ctx.drawImage(img, value.x, value.y);
                                URL.revokeObjectURL(url); // Clean up the object URL
                            };
                        } else {
                            self.ctx.drawImage(value.img, value.x, value.y);
                        }
                    }

                    for (const [key, value] of Object.entries(self.circles)) {
                        self._drawCircle(value);
                    }
                    resolve();
                }));
            }).then(() => {
                //self.canvas.toBlob(function (blob) {
                //    let link = document.createElement('a');
                //    link.download = "my-image.png";
                //    link.href = URL.createObjectURL(blob);
                //    link.click();
                //});
                //self._containerParams.classList.remove('print-disabled');
                //self._loader.style.display = 'none';
                self.canvas.toBlob(async function (blob) {
                    const { jsPDF } = window.jspdf;

                    // Create a new PDF document
                    const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size

                    // Convert the image blob to an image URL
                    const imgURL = URL.createObjectURL(blob);

                    // Load the image into the PDF
                    const img = new Image();
                    img.src = imgURL;
                    img.onload = function () {
                        const textMargin = 10; // Align image margin with text margin
                        const pageWidth = 210; // A4 page width in mm
                        const pageHeight = 297; // A4 page height in mm
                        const imgHeight = 148; // Original height for half page

                        // Calculate the width and height for the image, maintaining aspect ratio
                        const imgWidth = pageWidth - textMargin * 2; // Width minus margins
                        const adjustedHeight = imgHeight - textMargin * 2; // Adjust height with the same margin

                        // Add the image to the PDF
                        pdf.addImage(img, 'PNG', textMargin, textMargin, imgWidth, adjustedHeight);

                        // Draw a black border around the image
                        pdf.setDrawColor(0); // Set the border color to black
                        pdf.setLineWidth(1); // Set the border thickness
                        pdf.rect(textMargin, textMargin, imgWidth, adjustedHeight); // Draw the border

                        //mysintesi = mysintesi.replace(/<br\s*\/?>/gi, "\n");
                        //mysintesi = mysintesi.replace(/<[^>]*>/g, ' ');
                        //mysintesi = mysintesi.replace(/\s+/g, ' ').trim();
                        mysintesi = mysintesi.replace(/<br\s*\/?>/gi, '\n');

                        // Remove all other HTML tags
                        mysintesi = mysintesi.replace(/<\/?[^>]+(>|$)/g, '');
                        // Add text content below the image
                        var prog = $("#cardsintesi_title").text();
                        var td6Text = $('#prog_tab tr.selected td:nth-child(7)').text();
                        var td7Text = $('#prog_tab tr.selected td:nth-child(8)').text();
                        pdf.text(`Progressive: - ${prog} `, textMargin, 160); // Align the header with the image margin
                        pdf.text(`DateTime :- ${td6Text} Duration :- ${td7Text} `, textMargin, 170); // Align the header with the image margin
                        //pdf.text(mysintesi, textMargin, 180); // Align the main content with the same margin
                        const lines = mysintesi.split('\n'); // Split the text by new lines
                        lines.forEach((line, index) => {
                            pdf.text(line, textMargin, 180 + (index * 10)); // Draw each line with incremented Y-coordinate
                        });
                       
                        pdf.save('mysintesipgen.pdf');

                        // Clean up
                        URL.revokeObjectURL(imgURL);
                    };
                });
                self._containerParams.classList.remove('print-disabled');
                self._loader.style.display = 'none';

            });
        },

        _manualPrintx: function (mysintesi) {
            let self = this;

            self.tilesImgs = {};
            self.markers = {};
            self.path = {};
            self.circles = {};

            let dimensions = self._map.getSize();
            self.zoom = self._map.getZoom();
            self.bounds = self._map.getPixelBounds();

            self.canvas = document.createElement('canvas');
            self.canvas.width = dimensions.x;
            self.canvas.height = dimensions.y;
            self.ctx = self.canvas.getContext('2d');

            this._changeScale(document.getElementById('scale').value);

            let promise = new Promise(function (resolve, reject) {
                self._getLayers(resolve);
            });

            promise.then(() => {
                debugger;
                return new Promise(((resolve, reject) => {
                    // Draw the map tiles
                    for (const [key, value] of Object.entries(self.tilesImgs)) {
                        self.ctx.drawImage(value.img, value.x, value.y, self.tileSize, self.tileSize);
                    }

                    // Draw the paths
                    for (const [key, value] of Object.entries(self.path)) {
                        self._drawPath(value);
                    }

                    // Handle markers (capture markers and draw them)
                    const svgPromises = [];
                    for (const [key, value] of Object.entries(self.markers)) {
                        if (value.icon) {
                            // Convert the icon to SVG and draw it
                            const svgElement = value.icon.createSvg();
                            const svgBlob = new Blob([svgElement.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
                            const url = URL.createObjectURL(svgBlob);
                            const img = new Image();
                            img.src = url;

                            svgPromises.push(new Promise((resolve) => {
                                img.onload = function () {
                                    self.ctx.drawImage(img, value.x, value.y);
                                    URL.revokeObjectURL(url); // Clean up
                                    resolve();
                                };
                            }));
                        } else {
                            // Handle regular icon markers
                            const img = new Image();
                            img.src = value.icon.options.iconUrl;
                            svgPromises.push(new Promise((resolve) => {
                                img.onload = function () {
                                    self.ctx.drawImage(img, value.x, value.y, 25, 41); // Adjust size based on your marker size
                                    resolve();
                                };
                            }));
                        }
                    }

                    // Draw circles
                    for (const [key, value] of Object.entries(self.circles)) {
                        self._drawCircle(value);
                    }

                    // Wait for all SVG promises to finish loading
                    Promise.all(svgPromises).then(resolve);
                }));
            }).then(() => {
                // Convert the canvas to a blob and generate a PDF
                self.canvas.toBlob(async function (blob) {
                    const { jsPDF } = window.jspdf;

                    // Create a new PDF document
                    const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size

                    // Convert the image blob to an image URL
                    const imgURL = URL.createObjectURL(blob);

                    // Load the image into the PDF
                    const img = new Image();
                    img.src = imgURL;
                    img.onload = function () {
                        const textMargin = 10; // Align image margin with text margin
                        const pageWidth = 210; // A4 page width in mm
                        const pageHeight = 297; // A4 page height in mm
                        const imgHeight = 148; // Original height for half page

                        // Calculate the width and height for the image, maintaining aspect ratio
                        const imgWidth = pageWidth - textMargin * 2; // Width minus margins
                        const adjustedHeight = imgHeight - textMargin * 2; // Adjust height with the same margin

                        // Add the image to the PDF
                        pdf.addImage(img, 'PNG', textMargin, textMargin, imgWidth, adjustedHeight);

                        // Draw a black border around the image
                        pdf.setDrawColor(0); // Set the border color to black
                        pdf.setLineWidth(1); // Set the border thickness
                        pdf.rect(textMargin, textMargin, imgWidth, adjustedHeight); // Draw the border

                        mysintesi = mysintesi.replace(/<br\s*\/?>/gi, "\n");
                        mysintesi = mysintesi.replace(/<[^>]*>/g, ' ');
                        mysintesi = mysintesi.replace(/\s+/g, ' ').trim();

                        // Add text content below the image
                        var prog = $("#cardsintesi_title").text();
                        pdf.text(`Progressive: - ${prog}`, textMargin, 160); // Align the header with the image margin
                        pdf.text(mysintesi, textMargin, 180); // Align the main content with the same margin

                        // Save the PDF
                        pdf.save('mysintesipgen.pdf');

                        // Clean up
                        URL.revokeObjectURL(imgURL);
                    };
                });
                self._containerParams.classList.remove('print-disabled');
                self._loader.style.display = 'none';
            });
        },
        //_manualPrintx: function (mysintesi) {
        //    let self = this;
        //    debugger;
        //    self.tilesImgs = {};
        //    self.markers = {};
        //    self.path = {};
        //    self.circles = {};

        //    let dimensions = self._map.getSize();
        //    self.zoom = self._map.getZoom();
        //    self.bounds = self._map.getPixelBounds();

        //    self.canvas = document.createElement('canvas');
        //    self.canvas.width = dimensions.x;
        //    self.canvas.height = dimensions.y;
        //    self.ctx = self.canvas.getContext('2d');

        //    this._changeScale(document.getElementById('scale').value);

        //    let promise = new Promise(function (resolve, reject) {
        //        self._getLayers(resolve);
        //    });

        //    promise.then(() => {
        //        return new Promise(((resolve, reject) => {
        //            // Draw tiles
        //            for (const [key, value] of Object.entries(self.tilesImgs)) {
        //                self.ctx.drawImage(value.img, value.x, value.y, self.tileSize, self.tileSize);
        //            }

        //            // Draw paths
        //            for (const [key, value] of Object.entries(self.path)) {
        //                self._drawPath(value);
        //            }

        //            // Draw markers (including Font Awesome icons for start and end)
        //            for (const [key, value] of Object.entries(self.markers)) {
        //                if (value.icon != undefined) {
        //                    const svgElement = value.icon.createSvg();
        //                    const svgBlob = new Blob([svgElement.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
        //                    const url = URL.createObjectURL(svgBlob);
        //                    const img = new Image();
        //                    img.crossOrigin = 'Anonymous';
        //                    img.src = url;
        //                    img.onload = function () {
        //                        self.ctx.drawImage(img, value.x, value.y);
        //                        URL.revokeObjectURL(url); // Clean up
        //                    };
        //                } else {
        //                    self.ctx.drawImage(value.img, value.x, value.y);
        //                }
        //            }

        //            // Draw Font Awesome start and end markers manually
        //            self._drawFontAwesomeMarkers(self.ctx, resolve); // Pass resolve to ensure image loading is awaited

        //            // Draw circles
        //            for (const [key, value] of Object.entries(self.circles)) {
        //                self._drawCircle(value);
        //            }
        //           // resolve();
        //        }));
        //    }).then(() => {
        //        self.canvas.toBlob(async function (blob) {
        //            const { jsPDF } = window.jspdf;
        //            const pdf = new jsPDF('p', 'mm', 'a4');
        //            const imgURL = URL.createObjectURL(blob);
        //            const img = new Image();
        //            img.src = imgURL;
        //            img.crossOrigin = 'Anonymous';
        //            img.onload = function () {
        //                pdf.addImage(img, 'PNG', 0, 0, 210, 148);
        //                pdf.text(mysintesi, 10, 160);
        //                pdf.save('mysintesipgen.pdf');
        //                URL.revokeObjectURL(imgURL);
        //            };
        //        });

        //        self._containerParams.classList.remove('print-disabled');
        //        self._loader.style.display = 'none';
        //    });
        //},

        _drawFontAwesomeMarkers: function (ctx, resolve) {
            // Capture Font Awesome start marker
            const startMarker = document.querySelector('i.fa-flag[style*="color:red"]');
            const endMarker = document.querySelector('i.fa-flag[style*="color:green"]');
            debugger;
            let iconsLoaded = 0;

            const checkIfAllLoaded = () => {
                iconsLoaded++;
                if (iconsLoaded === 2) {
                    resolve(); // Resolve promise after both icons are drawn
                }
            };

            // Check if the start marker exists and render it
            if (startMarker) {
                this._drawFontAwesomeIcon(ctx, startMarker, { x: startMarker.offsetLeft, y: startMarker.offsetTop }, checkIfAllLoaded);
            } else {
                checkIfAllLoaded(); // Call even if marker is not present
            }

            // Check if the end marker exists and render it
            if (endMarker) {
                this._drawFontAwesomeIcon(ctx, endMarker, { x: endMarker.offsetLeft, y: endMarker.offsetTop }, checkIfAllLoaded);
            } else {
                checkIfAllLoaded(); // Call even if marker is not present
            }
        },

        _drawFontAwesomeIcon: function (ctx, iconElement, position, onComplete) {
            debugger;
            const iconHTML = iconElement.outerHTML;
            const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <foreignObject width="100%" height="100%">
                ${iconHTML}
            </foreignObject>
        </svg>
    `;
            const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.src = url;
            img.crossOrigin = 'Anonymous';
            img.onload = function () {
                ctx.drawImage(img, position.x, position.y);
                URL.revokeObjectURL(url); // Clean up
                onComplete(); // Notify completion of loading
            };
            img.onerror = function () {
                onComplete(); // Handle error and continue
            };
        }
    });
    L.control.Printage = function (options) {
        return new L.Control.Printage(options);
    };
}, window));
