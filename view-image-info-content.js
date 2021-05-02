/* 
  View Image Info Reborn - Content Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to gather image details from right-clicked image, and to generate info overlay
  version 1.0 - MVP
  version 1.2 - bug fixes for stand-alone image pages, cache bypass for overlay
  version 1.3 - bug fixes for missing data
  version 1.4 - bug fixes for missing data
  version 1.5.1 - add Last-Modified
  version 1.5.2 - bug fix for Size
  version 1.6 - Save As options
  version 1.8 - Referrer for preview, popup position option, attribute list, updated layout
  version 1.8.1 - Adjust source URL conflict resolution to prefer currentSrc, check for picture tag
  version 1.9.1 - bug fixes
*/

/**** Handle Requests from Background script ****/
let moredetails = {};
function handleMessage(request, sender, sendResponse){
	// Collect image and page info
	if ('getdetails' in request){
		moredetails = request.getdetails;
		var el = browser.menus.getTargetElement(moredetails.targetElementId);
		if (el){
			moredetails.pageUrl = location.href;
			moredetails.pageTitle = document.title;
			if (document.contentType.indexOf('image/') === 0){ // stand-alone
				moredetails.referUrl = document.referrer;
			} else {
				moredetails.referUrl = '';
			}
			moredetails.currentSrc = el.currentSrc;
			moredetails.imgSrc = el.src;
			moredetails.naturalHeight = el.naturalHeight;
			moredetails.naturalWidth = el.naturalWidth;
			moredetails.scaledHeight = el.height;
			moredetails.scaledWidth = el.width;
			if (document.contentType.indexOf('image/') === 0){ // stand-alone
				moredetails.mimeType = document.contentType;
			} else {
				moredetails.mimeType = null;
			}
			moredetails.decodedSize = null;
			moredetails.transferSize = null;
			moredetails.transferTime = null;
			if (window.performance){
				var imgp = performance.getEntriesByName(moredetails.currentSrc);
				if (!imgp) imgp = performance.getEntriesByName(moredetails.sourceUrl);
				if (!imgp) imgp = performance.getEntriesByName(moredetails.imgSrc);
				if (imgp && imgp.length > 0 && imgp[0].decodedBodySize > 0){
					moredetails.decodedSize = imgp[0].decodedBodySize;
					if (imgp[0].transferSize > 0) moredetails.transferSize = imgp[0].transferSize;
					moredetails.transferTime = imgp[0].duration;
				}
			}
			// Store alphabetized array of <img> attributes [v1.8]
			var arrAtt = [];
			var elAtt = el.attributes;
			for (var i=0; i<elAtt.length; i++){
				arrAtt.push({
					attrname: elAtt[i].name,
					attrvalue: elAtt[i].value
				});
			}
			arrAtt.sort((a, b) => a.attrname.toLowerCase() < b.attrname.toLowerCase() ? -1 : (a.attrname.toLowerCase() > b.attrname.toLowerCase() ? 1 : 0));
			moredetails.attribJSON = JSON.stringify(arrAtt);
			// Check for parent link [v1.8]
			var ahref = '';
			var ael = el.closest('a');
			if (ael && ael.href) ahref = ael.href;
			moredetails.ahref = ahref;
			// Check for parent picture element [v1.8.1]
			var picturesrc = [];
			var pict = el.closest('picture');
			if (pict){
				var psrcs = pict.querySelectorAll('source');
				for (var i=0; i<psrcs.length; i++){
					var psrcitem = {
						srcset: '',
						media: ''
					};
					if(psrcs[i].srcset){
						psrcitem.srcset = psrcs[i].srcset;
					}
					if(psrcs[i].media){
						psrcitem.media = psrcs[i].media;
					}
					picturesrc.push(psrcitem);
				}
			}
			moredetails.picsrc = JSON.stringify(picturesrc);
			// Send updated details to background
			browser.runtime.sendMessage({
				showinfo: moredetails
			});

			// Do we need to show it right here right now?
			if (moredetails.axn == 'inpage'){
				var tbl = document.createElement('table');
				tbl.id = 'viir-' + moredetails.now;
				tbl.className = 'viewimageinforeborn';
				tbl.setAttribute('colorscheme', moredetails.colorscheme);
				tbl.setAttribute('style', '--info-font-size: ' + moredetails.fontsize);
				if (document.contentType.indexOf('image/') === 0) tbl.setAttribute('standalone', true);
				var tbod = document.createElement('tbody');
				tbl.appendChild(tbod);
				// row 1
				var row = document.createElement('tr');
				var th = document.createElement('th');
				var td = document.createElement('td');
				th.textContent = 'Image URL: ';
				var btn = document.createElement('button');
				btn.textContent = ' X ';
				btn.id = 'btnclose' + tbl.id;
				btn.setAttribute('style', 'float: right');
				btn.className = 'closebtn';
				td.appendChild(btn);
				var lnk = document.createElement('a');
				if (moredetails.currentSrc != ''){
					lnk.href = moredetails.currentSrc;
					lnk.textContent = moredetails.currentSrc;
				} else if (moredetails.imgSrc != ''){
					lnk.href = moredetails.imgSrc;
					lnk.textContent = moredetails.imgSrc;
				} else {
					lnk.href = moredetails.sourceUrl;
					lnk.textContent = moredetails.sourceUrl;
				}
				td.appendChild(lnk);
				row.appendChild(th);
				row.appendChild(td);
				tbod.appendChild(row);
				// row 2
				row = document.createElement('tr');
				th = document.createElement('th');
				td = document.createElement('td');
				th.textContent = 'Image Type: ';
				td.id = 'mime-' + moredetails.now;
				if (moredetails.mimeType) td.textContent = moredetails.mimeType.slice(moredetails.mimeType.indexOf('/')+1).toUpperCase();
				else td.textContent = '(Unconfirmed)';
				row.appendChild(th);
				row.appendChild(td);
				tbod.appendChild(row);
				// row 3
				row = document.createElement('tr');
				th = document.createElement('th');
				td = document.createElement('td');
				th.textContent = 'Dimensions: ';
				var dim = moredetails.naturalWidth + 'px × ' + moredetails.naturalHeight + 'px';
				if (moredetails.naturalWidth != moredetails.scaledWidth || moredetails.naturalHeight != moredetails.scaledHeight){
					dim += ' (scaled to ' + moredetails.scaledWidth + 'px × ' + moredetails.scaledHeight + 'px)';
				}
				td.textContent = dim;
				row.appendChild(th);
				row.appendChild(td);
				tbod.appendChild(row);
				// row 4
				row = document.createElement('tr');
				th = document.createElement('th');
				td = document.createElement('td');
				th.textContent = 'Image Size: ';
				td.id = 'decodedSize-' + moredetails.now;
				var sz = '(Unconfirmed)';
				if (moredetails.decodedSize){
					sz = (+(Math.round(moredetails.decodedSize/1024 + 'e+2')  + 'e-2')).toLocaleString() + ' KB (' + moredetails.decodedSize.toLocaleString() + ')';
					if (moredetails.transferSize > 0) sz += ' (transferred ' + (+(Math.round(moredetails.transferSize/1024 + 'e+2')  + 'e-2')).toLocaleString() + ' KB (' + moredetails.transferSize.toLocaleString() + ') in ' +  (+(Math.round(moredetails.transferTime/1000 + 'e+2')  + 'e-2')).toLocaleString() + ' seconds)';
				}
				td.textContent = sz;
				row.appendChild(th);
				row.appendChild(td);
				tbod.appendChild(row);
				// row 5
				if (moredetails.altText && document.contentType.indexOf('image/') != 0){
					row = document.createElement('tr');
					th = document.createElement('th');
					td = document.createElement('td');
					th.textContent = 'Alt text: ';
					td.textContent = moredetails.altText;
					row.appendChild(th);
					row.appendChild(td);
					tbod.appendChild(row);
				}
				// row 6
				if (moredetails.titleText && document.contentType.indexOf('image/') != 0){
					row = document.createElement('tr');
					th = document.createElement('th');
					td = document.createElement('td');
					th.textContent = 'Title text: ';
					td.textContent = moredetails.titleText;
					row.appendChild(th);
					row.appendChild(td);
					tbod.appendChild(row);
				}
				// row 7
				row = document.createElement('tr');
				th = document.createElement('th');
				td = document.createElement('td');
				th.textContent = 'Last Modified: ';
				td.id = 'mod-' + moredetails.now;
				td.textContent = moredetails.lastModified;
				row.appendChild(th);
				row.appendChild(td);
				tbod.appendChild(row);
				document.body.appendChild(tbl);

				// Line up the panel with the top of the image
				var tgt = tbl;
				var br = el.getBoundingClientRect();
				if (document.contentType.indexOf('image/') === 0){ // stand-alone
					if (br.top > (tgt.offsetHeight + 4)){
						tgt.style.top = window.scrollY + (br.top - (tgt.offsetHeight + 4)) + 'px';
					} else {
						tgt.style.top = '0px';
					}
					window.addEventListener('resize', function(evt){
						var tgt = document.querySelector('.viewimageinforeborn');
						var img = document.querySelector('img');
						var br = el.getBoundingClientRect();
						if (br.top > (tgt.offsetHeight + 4)){
							tgt.style.top = window.scrollY + (br.top - (tgt.offsetHeight + 4)) + 'px';
						} else {
							tgt.style.top = '0px';
						}
					}, false);
				} else { // overlaid inline
					var par = el.closest('p, div, section, aside, header, main, footer, article, body');
					par.appendChild(tgt);
					if (window.getComputedStyle(par,null).getPropertyValue("position") == 'static') par.style.position = 'relative';
					tgt.style.top = Math.max(br.top - par.getBoundingClientRect().top + par.scrollTop, 0) + 'px';;
					tgt.style.left = window.scrollX + Math.max(br.left - par.getBoundingClientRect().left, 0) + 'px';
					tgt.style.width = br.width + 'px';
				}
				// Make sure the bar is in view
				if (br.top < 0 || br.top > window.innerHeight) tgt.scrollIntoView();

				// Event handlers
				document.getElementById('btnclose' + tbl.id).addEventListener('click', function(evt){
					evt.target.closest('.viewimageinforeborn').remove();
				}, false);
			}

			// If user requested overlay: trigger image request for header intercept in the background
			// Attempt cache bypass [version 1.2]
			if (moredetails.axn == 'inpage'){
				var imgTest = new Image();
				imgTest.onload = function(){
					// fill in missing size info when that happens (url's sometimes vary) [v1.4]
					if (!moredetails.decodedSize && window.performance){
						var resos = performance.getEntriesByType('resource');
						var perfrec = resos.find(obj => obj.name.indexOf(moredetails.currentSrc) > -1);
						if (!perfrec) perfrec = resos.find(obj => obj.name.indexOf(moredetails.sourceUrl) > -1);
						if (!perfrec) perfrec = resos.find(obj => obj.name.indexOf(moredetails.imgSrc) > -1);
						if (perfrec && perfrec.decodedBodySize > 0){
							moredetails.decodedSize = perfrec.decodedBodySize;
							document.getElementById('decodedSize-' + moredetails.now).textContent = (+(Math.round(moredetails.decodedSize/1024 + 'e+2')  + 'e-2')).toLocaleString() + ' KB (' + moredetails.decodedSize.toLocaleString() + ')';
						}
					}
					imgTest.remove();
				};
				imgTest.onerror = function(){
					imgTest.remove();
				};
				var url = new URL(moredetails.currentSrc);
				if (url.search.length == 0) url.search = '?viirnow=' + moredetails.now;
				else url.search += '&viirnow=' + moredetails.now;
				imgTest.src = url.href;
			}
		} else if (targetProps.currentSrc == moredetails.sourceUrl) {	// [v1.9.1]
			// populate moredetails from targetprops
			moredetails.pageUrl = targetProps.pageUrl;
			moredetails.pageTitle = targetProps.pageTitle;
			moredetails.referUrl = targetProps.referUrl;
			moredetails.currentSrc = targetProps.currentSrc;
			moredetails.imgSrc = targetProps.imgSrc;
			moredetails.naturalHeight = targetProps.naturalHeight;
			moredetails.naturalWidth = targetProps.naturalWidth;
			moredetails.scaledHeight = targetProps.scaledHeight;
			moredetails.scaledWidth = targetProps.scaledWidth;
			moredetails.mimeType = targetProps.mimeType;
			moredetails.decodedSize = targetProps.decodedSize;
			moredetails.transferSize = targetProps.transferSize;
			moredetails.transferTime = targetProps.transferTime;
			moredetails.attribJSON = targetProps.attribJSON;
			moredetails.ahref = targetProps.ahref;
			moredetails.picsrc = targetProps.picsrc;
			// Send updated details to background
			browser.runtime.sendMessage({
				showinfo: moredetails
			});
		} else {
			window.alert('Wasn\'t able to determine where you right-clicked??');
		}
	} else if ('headerdetails' in request){
		// Update mimeType
		var moredetails = request.headerdetails;
		var tdid = 'mime-' + moredetails.now;
		if (moredetails.mimeType && document.getElementById(tdid)){
			document.getElementById(tdid).textContent = moredetails.mimeType.slice(moredetails.mimeType.indexOf('/')+1).toUpperCase();
		}
		tdid = 'mod-' + moredetails.now;
		if (moredetails.lastModified && moredetails.lastModified.length > 0 && document.getElementById(tdid)){
			document.getElementById(tdid).textContent = moredetails.lastModified;
		}
	}
}
browser.runtime.onMessage.addListener(handleMessage);
