/* 
  View Image Info Reborn - Content Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to gather image details from right-clicked image, and to generate info overlay
  version 1.0 - MVP
  version 1.2 - bug fixes for stand-alone image pages, cache bypass for overlay
*/

/**** Handle Requests from Background script ****/
let moredetails = {};
function handleMessage(request, sender, sendResponse){
	// Collect image and page info
	if ('getdetails' in request){
		var moredetails = request.getdetails;
		var el = browser.menus.getTargetElement(moredetails.targetElementId);
		if (el){
			moredetails.pageUrl = location.href;
			moredetails.pageTitle = document.title;
			moredetails.currentSrc = el.currentSrc;
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
				var imgp = performance.getEntriesByName(el.currentSrc);
				if (imgp && imgp.length > 0 && imgp[0].decodedBodySize > 0){
					moredetails.decodedSize = imgp[0].decodedBodySize;
					if (imgp[0].transferSize > 0) moredetails.transferSize = imgp[0].transferSize;
					moredetails.transferTime = imgp[0].duration;
				}
			}
			moredetails.altText = null;
			if (el.getAttribute('alt') && el.getAttribute('alt').trim().length > 0) moredetails.altText = el.getAttribute('alt');
			moredetails.titleText = null;
			if (el.getAttribute('title') && el.getAttribute('title').trim().length > 0) moredetails.titleText = el.getAttribute('title');
			
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
				tbl.setAttribute('fontsize', moredetails.fontsize);
				if (document.contentType.indexOf('image/') === 0) tbl.setAttribute('standalone', true);
				var tbod = document.createElement('tbody');
				tbl.appendChild(tbod);
				// row 1
				var row = document.createElement('tr');
				var th = document.createElement('th');
				var td = document.createElement('td');
				th.textContent = 'Image URL: ';
				var lnk = document.createElement('a');
				lnk.href = moredetails.sourceUrl;
				lnk.textContent = moredetails.sourceUrl
				td.appendChild(lnk);
				var btn = document.createElement('button');
				btn.textContent = ' X ';
				btn.id = 'btnclose' + tbl.id;
				btn.setAttribute('style', 'float: right');
				btn.className = 'closebtn';
				td.appendChild(btn);
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
				var sz = (+(Math.round(moredetails.decodedSize/1024 + 'e+2')  + 'e-2')) + ' KB (' + moredetails.decodedSize + ')';
				if (moredetails.transferSize > 0) sz += ' (transferred ' + (+(Math.round(moredetails.transferSize/1024 + 'e+2')  + 'e-2')) + ' KB (' + moredetails.transferSize + ') in ' +  (+(Math.round(moredetails.transferTime/1000 + 'e+2')  + 'e-2')) + ' seconds)';
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

			// If no mimeType and user requested overlay: trigger image request for header intercept in the background
			// Attempt cache bypass [version 1.2]
			if (moredetails.mimeType == null && moredetails.axn == 'inpage'){
				var imgTest = new Image();
				imgTest.onload = function(){
					imgTest.remove();
				};
				imgTest.onerror = function(){
					imgTest.remove();
				};
				var url = new URL(moredetails.sourceUrl);
				if (url.search.length == 0) url.search = '?viirnow=' + moredetails.now;
				else url.search += '&viirnow=' + moredetails.now;
				imgTest.src = url.href;
			}

		} else {
			window.alert('Wasn\'t able to determine where you right-clicked!');
		}
	} else if ('headerdetails' in request){
		// Update mimeType
		var moredetails = request.headerdetails;
		var tdid = 'mime-' + moredetails.now;
		if (moredetails.mimeType && document.getElementById(tdid)){
			document.getElementById(tdid).textContent = moredetails.mimeType.slice(moredetails.mimeType.indexOf('/')+1).toUpperCase();
		}
	}
}
browser.runtime.onMessage.addListener(handleMessage);
