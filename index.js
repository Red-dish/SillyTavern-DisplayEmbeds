import { eventSource, event_types, reloadMarkdownProcessor } from '../../../script.js';
import { isExternalMediaAllowed } from '../../../scripts/chats.js';
import APIKey from 'trenorAPI.json';

const getTenorDirectUrl = async (tenorViewUrl) => {  
    try {  
        // Extract GIF ID from Tenor view URL  
        const gifId = tenorViewUrl.match(/view\/[^\/]*-(\d+)$/)?.[1];  
        if (!gifId) return null;  
          
        // Call Tenor API to get direct media URL  
        const response = await fetch(`https://tenor.googleapis.com/v2/posts?ids=${gifId}&key=${APIKey}`);  
        const data = await response.json();  
          
        if (data.results?.[0]?.media_formats?.gif?.url) {  
            return data.results[0].media_formats.gif.url;  
        }  
    } catch (error) {  
        console.error('Failed to fetch Tenor GIF:', error);  
    }  
    return null;  
};

/** 
 * Defining the Showdown extension for media embedding
 * Uses ![text](url) handler to ALWAYS embed images and gifs as a fallback 
 * uses [text](url) handdler mainly
* */


const mediaEmbedExtension = () => {
    // the ![text]{url) handler
    return [{
        type: 'output',
        regex: /!\[([^\]]*)\]\(([^)]+)\)/g,
        replace: (match, altText, url) => {
            const cleanUrl = url.trim().replace(/[\n\r\t]/g, '');
            if (!cleanUrl.match(/^https?:\/\//i) && !cleanUrl.startsWith('/')) {
                return `<span class="error">Invalid image URL: ${encodeURIComponent(cleanUrl)}</span>`;
            }

            if (!isExternalMediaAllowed()) {
                const isExternal = cleanUrl.includes('://') && !cleanUrl.startsWith(window.location.origin);
                if (isExternal) {
                    return `<span class="error">External media blocked: ${encodeURIComponent(cleanUrl)}. Enable 'Ext. Media' to allow.</span>`;
                }
            }

            const alt = altText.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `<img src="${cleanUrl}" alt="${alt}" class="embedded-media" style="max-width: 100%; height: auto;" />`;
        }
    },
    //the [text](url) handler
    {
        type: 'output',
        regex: /(?<!\!)\[([^\]]*)\]\(([^)]+)\)/g,
        replace: (match, altText, url) => {
            const cleanUrl = url.trim().replace(/[\n\r\t]/g, '');
            const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|tmp|ico)(\?.*)?$/i;
            const isImageUrl = imageExtensions.test(cleanUrl);

            if(isImageUrl){
                if(!cleanUrl.match(/^https?:\/\//i) && !cleanUrl.startsWith('/')){
                    return `<span class="error">Invalid image URL: $(encodeURIComponent(cleanUrl)}</span>`;
                }

                if(isExternalMediaAllowed()){
                    const isExternal = cleanUrl.includes('://') && !cleanUrl.startsWith(window.location.origin);
                    if(isExternal){
                        return `<span class="error">External media blocked: $(encodeURIComponent(cleanUrl)). Enable 'Ext. Media' to allow.</span>`;
                    }
                }

                const alt = linkText.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<img src=$"(cleanUrl)"alt="$(alt)" class="embedd-media" style="max-width: 100%; height: auto;"/>`;
            }

            return match;
        }
               
    }];


};

// Hook into markdown processor creation
let originalReloadMarkdownProcessor;
const hookMarkdownProcessor = () => {
    if (window.reloadMarkdownProcessor && !originalReloadMarkdownProcessor) {
        originalReloadMarkdownProcessor = window.reloadMarkdownProcessor;
        window.reloadMarkdownProcessor = function () {
            const converter = originalReloadMarkdownProcessor.call(this);
            converter.addExtension(mediaEmbedExtension(), 'mediaEmbed');
            console.log('MediaEmbed: Added extension to Showdown converter');
            return converter;
        };
        // Reload to apply changes
        window.reloadMarkdownProcessor();
    }
};

// Configure DOMPurify to allow embedded media
const configureDOMPurify = () => {
    const { DOMPurify } = window.SillyTavern.libs;
    if (DOMPurify) {
        DOMPurify.addHook('afterSanitizeAttributes', (node) => {
            if (node.tagName === 'IMG' && node.classList.contains('embedded-media')) {
                // Preserve embedded-media img tags
                node.setAttribute('style', 'max-width: 100%; height: auto;');
                if (node.getAttribute('src')) {
                    node.setAttribute('src', node.getAttribute('src'));
                }
            }
        });
        console.log('MediaEmbed: DOMPurify configured for embedded media');
    } else {
        console.error('MediaEmbed: DOMPurify not found');
    }
};

// Initialize the extension
const init = () => {
    hookMarkdownProcessor();
    configureDOMPurify();
    console.log('MediaEmbed: Extension initialized');
};

// Hook into APP_READY event
eventSource.on(event_types.APP_READY, init);

// Run initialization immediately in case APP_READY has already fired
init();