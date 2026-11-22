#!/usr/bin/env node
/* ============================================================
 * KORTEX - LOJA DE EXTENSOES (Chrome Web Store)
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const DATA = {"files": {"src/main/webstore-install.js": "Ly8gc3JjL21haW4vd2Vic3RvcmUtaW5zdGFsbC5qcyDigJQgaW5zdGFsYXIgZXh0ZW5zw7VlcyBkYSBDaHJvbWUgV2ViIFN0b3JlIGRlbnRybyBkbyBLb3J0ZXgKY29uc3QgeyBhcHAsIHNlc3Npb24sIGlwY01haW4gfSA9IHJlcXVpcmUoJ2VsZWN0cm9uJyk7CmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7CmNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKTsKY29uc3QgQWRtWmlwID0gcmVxdWlyZSgnYWRtLXppcCcpOwoKY29uc3QgSURfUkUgPSAvXlthLXBdezMyfSQvOwpjb25zdCBERVRBSUxfUkUgPSAvXC9kZXRhaWxcLyg/OlteL10rXC8pPyhbYS1wXXszMn0pKD86Wy8/I118JCkvOwpjb25zdCBTVE9SRV9VUkwgPSAvXmh0dHBzOlwvXC9jaHJvbWV3ZWJzdG9yZVwuZ29vZ2xlXC5jb21cLy87CmNvbnN0IGJ1c3kgPSBuZXcgU2V0KCk7CmxldCBjdHggPSB7fTsKCi8qIEFjZWl0YSBvIElEIHB1cm8gb3UgcXVhbHF1ZXIgbGluayBkYSBww6FnaW5hIGRhIGV4dGVuc8OjbyAqLwpmdW5jdGlvbiBwYXJzZUlkKGlucHV0KSB7CiAgY29uc3QgcyA9IFN0cmluZyhpbnB1dCB8fCAnJykudHJpbSgpOwogIGlmIChJRF9SRS50ZXN0KHMpKSByZXR1cm4gczsKICB0cnkgeyBjb25zdCBtID0gREVUQUlMX1JFLmV4ZWMobmV3IFVSTChzKS5wYXRobmFtZSk7IGlmIChtKSByZXR1cm4gbVsxXTsgfSBjYXRjaCB7fQogIGNvbnN0IG0gPSBERVRBSUxfUkUuZXhlYyhzKTsKICByZXR1cm4gbSA/IG1bMV0gOiBudWxsOwp9CgovKiBDUlgyL0NSWDMgLT4gWklQICh1c2EgbyB0YW1hbmhvIGRvIGNhYmXDp2FsaG8gZW0gdmV6IGRlIHByb2N1cmFyICJQSyIgw6BzIGNlZ2FzKSAqLwpmdW5jdGlvbiBjcnhUb1ppcChidWYpIHsKICBpZiAoYnVmLmxlbmd0aCA+IDE2ICYmIGJ1Zi50b1N0cmluZygnbGF0aW4xJywgMCwgNCkgPT09ICdDcjI0JykgewogICAgY29uc3QgdmVyID0gYnVmLnJlYWRVSW50MzJMRSg0KTsKICAgIGlmICh2ZXIgPT09IDMpIHJldHVybiBidWYuc3ViYXJyYXkoMTIgKyBidWYucmVhZFVJbnQzMkxFKDgpKTsKICAgIGlmICh2ZXIgPT09IDIpIHJldHVybiBidWYuc3ViYXJyYXkoMTYgKyBidWYucmVhZFVJbnQzMkxFKDgpICsgYnVmLnJlYWRVSW50MzJMRSgxMikpOwogICAgdGhyb3cgbmV3IEVycm9yKCdWZXJzw6NvIGRlIENSWCBkZXNjb25oZWNpZGE6ICcgKyB2ZXIpOwogIH0KICBpZiAoYnVmLmxlbmd0aCA+IDQgJiYgYnVmWzBdID09PSAweDUwICYmIGJ1ZlsxXSA9PT0gMHg0QikgcmV0dXJuIGJ1ZjsKICB0aHJvdyBuZXcgRXJyb3IoJ08gZmljaGVpcm8gZGVzY2FycmVnYWRvIG7Do28gw6kgdW1hIGV4dGVuc8OjbyB2w6FsaWRhLicpOwp9Cgphc3luYyBmdW5jdGlvbiBkb3dubG9hZChpZCkgewogIGNvbnN0IHByb2QgPSBwcm9jZXNzLnZlcnNpb25zLmNocm9tZSB8fCAnMTIwLjAuMC4wJzsKICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9jbGllbnRzMi5nb29nbGUuY29tL3NlcnZpY2UvdXBkYXRlMi9jcng/cmVzcG9uc2U9cmVkaXJlY3Qmb3M9d2luJmFyY2g9eDY0Jm9zX2FyY2g9eDg2XzY0Jm5hY2xfYXJjaD14ODYtNjQmcHJvZD1jaHJvbWVjcngmcHJvZGNoYW5uZWw9JnByb2R2ZXJzaW9uPScgKwogICAgcHJvZCArICcmbGFuZz1wdC1QVCZhY2NlcHRmb3JtYXQ9Y3J4MixjcngzJng9JyArIGVuY29kZVVSSUNvbXBvbmVudCgnaWQ9JyArIGlkICsgJyZpbnN0YWxsc291cmNlPW9uZGVtYW5kJnVjJyk7CiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7IHJlZGlyZWN0OiAnZm9sbG93JyB9KTsKICBpZiAocmVzLnN0YXR1cyA9PT0gMjA0IHx8IHJlcy5zdGF0dXMgPT09IDQwNCkgdGhyb3cgbmV3IEVycm9yKCdFc3RhIGV4dGVuc8OjbyBuw6NvIGVzdMOhIGRpc3BvbsOtdmVsIHBhcmEgZG93bmxvYWQgKGZvaSByZW1vdmlkYSBkYSBsb2phIG91IMOpIHJlc3RyaXRhKS4nKTsKICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKCdGYWxoYSBhbyBkZXNjYXJyZWdhciBkYSBHb29nbGUgKEhUVFAgJyArIHJlcy5zdGF0dXMgKyAnKS4nKTsKICBjb25zdCBidWYgPSBCdWZmZXIuZnJvbShhd2FpdCByZXMuYXJyYXlCdWZmZXIoKSk7CiAgaWYgKGJ1Zi5sZW5ndGggPCAxMDApIHRocm93IG5ldyBFcnJvcignQSBsb2phIGRldm9sdmV1IHVtYSByZXNwb3N0YSB2YXppYS4nKTsKICByZXR1cm4gYnVmOwp9CgovKiBFeHRyYWkgY29tIHByb3Rlw6fDo28gY29udHJhICJ6aXAgc2xpcCIgKG5vbWVzIGNvbSAuLi8pICovCmZ1bmN0aW9uIGV4dHJhY3QoemlwQnVmLCBkaXIpIHsKICBjb25zdCB6aXAgPSBuZXcgQWRtWmlwKHppcEJ1Zik7CiAgZnMucm1TeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUsIGZvcmNlOiB0cnVlIH0pOwogIGZzLm1rZGlyU3luYyhkaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pOwogIGNvbnN0IHJvb3QgPSBwYXRoLnJlc29sdmUoZGlyKSArIHBhdGguc2VwOwogIGZvciAoY29uc3QgZSBvZiB6aXAuZ2V0RW50cmllcygpKSB7CiAgICBjb25zdCBuYW1lID0gZS5lbnRyeU5hbWUucmVwbGFjZSgvXFwvZywgJy8nKTsKICAgIGlmIChlLmlzRGlyZWN0b3J5IHx8IG5hbWUuc3RhcnRzV2l0aCgnX21ldGFkYXRhLycpKSBjb250aW51ZTsKICAgIGNvbnN0IGRlc3QgPSBwYXRoLnJlc29sdmUoZGlyLCBuYW1lKTsKICAgIGlmICghZGVzdC5zdGFydHNXaXRoKHJvb3QpKSB0aHJvdyBuZXcgRXJyb3IoJ0ZpY2hlaXJvIHN1c3BlaXRvIGRlbnRybyBkYSBleHRlbnPDo286ICcgKyBuYW1lKTsKICAgIGZzLm1rZGlyU3luYyhwYXRoLmRpcm5hbWUoZGVzdCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOwogICAgZnMud3JpdGVGaWxlU3luYyhkZXN0LCBlLmdldERhdGEoKSk7CiAgfQp9CgpmdW5jdGlvbiBzYXZlUmVnaXN0cnkoZGlyKSB7CiAgY29uc3QgZmlsZSA9IHBhdGguam9pbihhcHAuZ2V0UGF0aCgndXNlckRhdGEnKSwgJ2V4dGVuc2lvbnMuanNvbicpOwogIGxldCBsaXN0ID0gW107CiAgdHJ5IHsgbGlzdCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4JykpOyB9IGNhdGNoIHt9CiAgaWYgKCFBcnJheS5pc0FycmF5KGxpc3QpKSBsaXN0ID0gW107CiAgaWYgKCFsaXN0LmluY2x1ZGVzKGRpcikpIHsgbGlzdC5wdXNoKGRpcik7IHRyeSB7IGZzLndyaXRlRmlsZVN5bmMoZmlsZSwgSlNPTi5zdHJpbmdpZnkobGlzdCkpOyB9IGNhdGNoIHt9IH0KICBpZiAoY3R4LnJlZ2lzdGVyRXh0ZW5zaW9uKSBjdHgucmVnaXN0ZXJFeHRlbnNpb24oZGlyKTsgLy8gbWFudMOpbSBhIGxpc3RhIGVtIG1lbWVyIGRvIG1haW4uanMgaWd1YWwKfQoKYXN5bmMgZnVuY3Rpb24gaW5zdGFsbChpbnB1dCkgewogIGNvbnN0IGlkID0gcGFyc2VJZChpbnB1dCk7CiAgaWYgKCFpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTGluayBvdSBJRCBpbnbDoWxpZG8uIENvbGEgbyBsaW5rIGRhIHDDoWdpbmEgZGEgZXh0ZW5zw6NvIG5hIENocm9tZSBXZWIgU3RvcmUuJyB9OwogIGlmIChidXN5LmhhcyhpZCkpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0VzdGEgZXh0ZW5zw6NvIGrDoSBlc3TDoSBhIHNlciBpbnN0YWxhZGEuJyB9OwogIGJ1c3kuYWRkKGlkKTsKICB0cnkgewogICAgY29uc3QgZGlyID0gcGF0aC5qb2luKGFwcC5nZXRQYXRoKCd1c2VyRGF0YScpLCAnZXh0ZW5zaW9ucycsIGlkKTsKICAgIGNvbnN0IHNlcyA9IHNlc3Npb24uZGVmYXVsdFNlc3Npb247CiAgICBjb25zdCB6aXAgPSBjcnhUb1ppcChhd2FpdCBkb3dubG9hZChpZCkpOwogICAgY29uc3Qgbm9ybSA9IChwKSA9PiBwYXRoLm5vcm1hbGl6ZShwKS50b0xvd2VyQ2FzZSgpOwogICAgY29uc3Qgb2xkID0gc2VzLmV4dGVuc2lvbnMuZ2V0QWxsRXh0ZW5zaW9ucygpLmZpbmQoKHgpID0+IG5vcm0oeC5wYXRoKSA9PT0gbm9ybShkaXIpKTsKICAgIGlmIChvbGQpIHsgdHJ5IHsgc2VzLmV4dGVuc2lvbnMucmVtb3ZlRXh0ZW5zaW9uKG9sZC5pZCk7IH0gY2F0Y2gge30gfQogICAgZXh0cmFjdCh6aXAsIGRpcik7CiAgICBjb25zdCBsb2FkZWQgPSBhd2FpdCBzZXMuZXh0ZW5zaW9ucy5sb2FkRXh0ZW5zaW9uKGRpciwgeyBhbGxvd0ZpbGVBY2Nlc3M6IHRydWUgfSk7CiAgICBzYXZlUmVnaXN0cnkoZGlyKTsKICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGlkOiBsb2FkZWQuaWQsIG5hbWU6IGxvYWRlZC5uYW1lIH07CiAgfSBjYXRjaCAoZSkgewogICAgbGV0IG1zZyA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpOwogICAgaWYgKC9tYW5pZmVzdC9pLnRlc3QobXNnKSkgbXNnICs9ICcgKGV4dGVuc8O1ZXMgTWFuaWZlc3QgVjIgasOhIG7Do28gc8OjbyBzdXBvcnRhZGFzIHBlbG8gbW90b3IgYXR1YWwpJzsKICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogbXNnIH07CiAgfSBmaW5hbGx5IHsgYnVzeS5kZWxldGUoaWQpOyB9Cn0KCi8qIEJvdMOjbyBmbHV0dWFudGUgIkluc3RhbGFyIG5vIEtvcnRleCIgaW5qZXRhZG8gbmEgbG9qYSByZWFsIChuw6NvIGRlcGVuZGUgZG8gSFRNTCBkYSBHb29nbGUpICovCmNvbnN0IFNUT1JFX1NDUklQVCA9IFN0cmluZy5yYXdgKGZ1bmN0aW9uICgpIHsKICBpZiAod2luZG93Ll9fa29ydGV4U3RvcmVJbml0KSByZXR1cm47CiAgd2luZG93Ll9fa29ydGV4U3RvcmVJbml0ID0gdHJ1ZTsKICB2YXIgUkUgPSAvXC9kZXRhaWxcLyg/OlteXC9dK1wvKT8oW2EtcF17MzJ9KSg/OltcLz8jXXwkKS87CiAgdmFyIGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpOwogIGJ0bi5pZCA9ICdrb3J0ZXgtaW5zdGFsbC1idG4nOwogIGJ0bi50eXBlID0gJ2J1dHRvbic7CiAgYnRuLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246Zml4ZWQ7cmlnaHQ6MjRweDtib3R0b206MjRweDt6LWluZGV4OjIxNDc0ODM2NDc7ZGlzcGxheTpub25lO2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O3BhZGRpbmc6MTJweCAyMHB4O2JvcmRlcjowO2JvcmRlci1yYWRpdXM6OTk5cHg7YmFja2dyb3VuZDojZmY1NzIyO2NvbG9yOiNmZmY7Zm9udDo2MDAgMTRweCBzeXN0ZW0tdWksU2Vnb2UgVUksc2Fucy1zZXJpZjtjdXJzb3I6cG9pbnRlcjtib3gtc2hhZG93OjAgOHB4IDI0cHggcmdiYSgwLDAsMCwuMzUpJzsKICB2YXIgYnVzeSA9IGZhbHNlOwogIGZ1bmN0aW9uIGxhYmVsKHQpIHsgYnRuLnRleHRDb250ZW50ID0gdDsgfQogIGZ1bmN0aW9uIGN1cnJlbnRJZCgpIHsgdmFyIG0gPSBSRS5leGVjKGxvY2F0aW9uLnBhdGhuYW1lKTsgcmV0dXJuIG0gPyBtWzFdIDogbnVsbDsgfQogIGZ1bmN0aW9uIHN5bmMoKSB7CiAgICBpZiAoIWJ0bi5pc0Nvbm5lY3RlZCkgKGRvY3VtZW50LmJvZHkgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChidG4pOwogICAgdmFyIGlkID0gY3VycmVudElkKCk7CiAgICBidG4uc3R5bGUuZGlzcGxheSA9IGlkID8gJ2ZsZXgnIDogJ25vbmUnOwogICAgaWYgKGlkICE9PSBidG4uZ2V0QXR0cmlidXRlKCdkYXRhLWlkJykpIHsgYnRuLnNldEF0dHJpYnV0ZSgnZGF0YS1pZCcsIGlkIHx8ICcnKTsgaWYgKCFidXN5KSBsYWJlbCgnSW5zdGFsYXIgbm8gS29ydGV4Jyk7IH0KICB9CiAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKCkgewogICAgdmFyIGlkID0gY3VycmVudElkKCk7CiAgICBpZiAoIWlkIHx8IGJ1c3kpIHJldHVybjsKICAgIGlmICghd2luZG93LmtvcnRleFN0b3JlKSB7IGxhYmVsKCdSZWluaWNpYSBvIEtvcnRleCBlIHRlbnRhIGRlIG5vdm8nKTsgcmV0dXJuOyB9CiAgICBidXN5ID0gdHJ1ZTsgYnRuLnN0eWxlLmJhY2tncm91bmQgPSAnIzU1NSc7IGxhYmVsKCdBIGluc3RhbGFyLi4uJyk7CiAgICB3aW5kb3cua29ydGV4U3RvcmUuaW5zdGFsbChpZCkudGhlbihmdW5jdGlvbiAocikgewogICAgICBpZiAociAmJiByLnN1Y2Nlc3MpIHsgYnRuLnN0eWxlLmJhY2tncm91bmQgPSAnIzEwYjk4MSc7IGxhYmVsKCdJbnN0YWxhZGEnICsgKHIubmFtZSA/ICc6ICcgKyByLm5hbWUgOiAnJykpOyB9CiAgICAgIGVsc2UgeyBidG4uc3R5bGUuYmFja2dyb3VuZCA9ICcjZTUzNDJiJzsgbGFiZWwoJ0Vycm86ICcgKyAoKHIgJiYgci5lcnJvcikgfHwgJ2Rlc2NvbmhlY2lkbycpKTsgfQogICAgfSkuY2F0Y2goZnVuY3Rpb24gKGUpIHsKICAgICAgYnRuLnN0eWxlLmJhY2tncm91bmQgPSAnI2U1MzQyYic7IGxhYmVsKCdFcnJvOiAnICsgKChlICYmIGUubWVzc2FnZSkgfHwgJ2Rlc2NvbmhlY2lkbycpKTsKICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkgewogICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsgYnVzeSA9IGZhbHNlOyBidG4uc3R5bGUuYmFja2dyb3VuZCA9ICcjZmY1NzIyJzsgbGFiZWwoJ0luc3RhbGFyIG5vIEtvcnRleCcpOyBzeW5jKCk7IH0sIDUwMDApOwogICAgfSk7CiAgfSk7CiAgbGFiZWwoJ0luc3RhbGFyIG5vIEtvcnRleCcpOwogIHNldEludGVydmFsKHN5bmMsIDcwMCk7CiAgc3luYygpOwp9KSgpO2A7CgpmdW5jdGlvbiBhdHRhY2hWaWV3KHZpZXcpIHsKICBjb25zdCB3YyA9IHZpZXcud2ViQ29udGVudHM7CiAgY29uc3QgcnVuID0gKCkgPT4gewogICAgdHJ5IHsgaWYgKFNUT1JFX1VSTC50ZXN0KHdjLmdldFVSTCgpKSkgd2MuZXhlY3V0ZUphdmFTY3JpcHQoU1RPUkVfU0NSSVBULCB0cnVlKS5jYXRjaCgoKSA9PiB7fSk7IH0gY2F0Y2gge30KICB9OwogIHdjLm9uKCdkb20tcmVhZHknLCBydW4pOwogIHdjLm9uKCdkaWQtbmF2aWdhdGUtaW4tcGFnZScsIHJ1bik7IC8vIGEgbG9qYSDDqSB1bWEgU1BBOiBuYXZlZ2FyIHBhcmEgb3V0cmEgZXh0ZW5zw6NvIG7Do28gcmVjYXJyZWdhIGEgcMOhZ2luYQp9CgpmdW5jdGlvbiBpbml0KGMpIHsKICBjdHggPSBjIHx8IHt9OwogIGlwY01haW4uaGFuZGxlKCdzdG9yZTppbnN0YWxsJywgKGUsIGlucHV0KSA9PiB7CiAgICBjb25zdCBmcm9tID0gKGUuc2VuZGVyRnJhbWUgJiYgZS5zZW5kZXJGcmFtZS51cmwpIHx8IGUuc2VuZGVyLmdldFVSTCgpIHx8ICcnOwogICAgaWYgKCEvXihrb3J0ZXg6fGZpbGU6fGh0dHBzOlwvXC9jaHJvbWV3ZWJzdG9yZVwuZ29vZ2xlXC5jb21cLykvLnRlc3QoZnJvbSkpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ09yaWdlbSBuw6NvIGF1dG9yaXphZGEuJyB9OwogICAgcmV0dXJuIGluc3RhbGwoaW5wdXQpOwogIH0pOwp9Cgptb2R1bGUuZXhwb3J0cyA9IHsgaW5pdCwgYXR0YWNoVmlldywgaW5zdGFsbCwgcGFyc2VJZCwgY3J4VG9aaXAsIFNUT1JFX1NDUklQVH0KfQ=="}, "patches": {"src/main/main.js": [{"label": "main.js: require do webstore-install", "type": "afterLine", "anchor": "const AdmZip = require('adm-zip');", "text": "const webstore = require('./webstore-install');", "marker": "require('./webstore-install')"}, {"label": "main.js: webstore.init (regista a extensao nova)", "type": "afterLine", "anchor": "features.init({ getViews: () => pageViews });", "text": "webstore.init({ registerExtension: (dir) => { if (!savedExtensions.includes(dir)) { savedExtensions.push(dir); try { fs.writeFileSync(extensionsJsonPath, JSON.stringify(savedExtensions)); } catch (e) {} } } });", "marker": "webstore.init("}, {"label": "main.js: botao Instalar na loja real, em cada separador", "type": "afterLine", "anchor": ["pro.attachView(id, view);", "pageViews[id].isPrivate = isPrivate;"], "text": "webstore.attachView(view);", "marker": "webstore.attachView("}, {"label": "main.js: desligar a injecao antiga (estava partida)", "type": "literal", "anchor": "if (view.webContents.getURL().includes('chromewebstore.google.com')) {", "text": "if (false && view.webContents.getURL().includes('chromewebstore.google.com')) {", "marker": "false && view.webContents.getURL()"}, {"label": "main.js: tabs:create com URL", "type": "literal", "anchor": "ipcMain.handle('tabs:create', () => createNewTab());", "text": "ipcMain.handle('tabs:create', (e, url) => createNewTab(url || 'about:blank'));", "marker": "tabs:create', (e, url)"}], "src/preload/webview-preload.js": [{"label": "webview-preload.js: installFromWebStore -> store:install (1)", "type": "literal", "anchor": "installFromWebStore: (id) => ipcRenderer.invoke('webstore:install', id),", "text": "installFromWebStore: (id) => ipcRenderer.invoke('store:install', id),", "optional": true}, {"label": "webview-preload.js: installFromWebStore -> store:install (2)", "type": "literal", "anchor": "installFromWebStore: (id) => ipcRenderer.invoke('webstore:install', id),", "text": "installFromWebStore: (id) => ipcRenderer.invoke('store:install', id),", "optional": true}, {"label": "webview-preload.js: tabs.create aceita URL", "type": "literal", "anchor": "create: () => ipcRenderer.invoke('tabs:create'),", "text": "create: (url) => ipcRenderer.invoke('tabs:create', url),", "optional": true}, {"label": "webview-preload.js: ponte kortexStore (so na Chrome Web Store)", "type": "afterLine", "anchor": "const { contextBridge, ipcRenderer } = require('electron');", "text": "if (location.hostname === 'chromewebstore.google.com') {\n  contextBridge.exposeInMainWorld('kortexStore', { install: (id) => ipcRenderer.invoke('store:install', id) });\n}", "marker": "kortexStore"}], "src/renderer/pages/extensions.html": [{"label": "extensions.html: botao abre a Chrome Web Store real", "type": "literal", "anchor": "window.kortex.tabs.navigate('current', 'kortex://store')", "text": "window.kortex.tabs.create('https://chromewebstore.google.com/?hl=pt-PT')", "marker": "tabs.create('https://chromewebstore"}, {"label": "extensions.html: texto do botao", "type": "regexReplace", "regex": "(\\s*)Loja do Kortex(\\s*</button>)", "text": "{{1}}Chrome Web Store{{2}}", "optional": true}, {"label": "extensions.html: link da barra lateral", "type": "literal", "anchor": "<a href=\"kortex://store\">Loja do Kortex</a>", "text": "<a href=\"https://chromewebstore.google.com/?hl=pt-PT\">Chrome Web Store</a>", "optional": true}, {"label": "extensions.html: campo 'instalar por link ou ID'", "type": "beforeLine", "anchor": "<div id=\"dev-actions\"", "text": "<input id=\"install-id\" placeholder=\"Colar link ou ID da extens\u00e3o\" spellcheck=\"false\" style=\"margin-left:12px;width:300px;height:30px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);outline:none;font-size:13px;\">\n<button class=\"btn-action\" id=\"btn-install-id\">Instalar</button>", "marker": "id=\"btn-install-id\""}, {"label": "extensions.html: logica do campo de instalar", "type": "beforeLine", "anchor": "searchInput.addEventListener('input', renderExtensions);", "text": "document.getElementById('btn-install-id').addEventListener('click', async () => {\n  const box = document.getElementById('install-id');\n  const btn = document.getElementById('btn-install-id');\n  const v = box.value.trim();\n  if (!v) return;\n  btn.textContent = 'A instalar...'; btn.disabled = true;\n  try {\n    const r = await window.kortex.installFromWebStore(v);\n    if (r && r.success) { box.value = ''; alert('Instalada: ' + (r.name || 'extens\u00e3o')); loadExtensions(); }\n    else alert('Erro: ' + ((r && r.error) || 'desconhecido'));\n  } catch (e) { alert('Erro: ' + e.message); }\n  btn.textContent = 'Instalar'; btn.disabled = false;\n});", "marker": "getElementById('btn-install-id').addEventListener"}]}};

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const pos = args.filter((a) => !a.startsWith('--'));
const ROOT = path.resolve(pos[0] || process.cwd());
const tty = process.stdout.isTTY;
const col = (c, s) => (tty ? `\x1b[${c}m${s}\x1b[0m` : s);
const green = (s) => col(32, s), yellow = (s) => col(33, s), red = (s) => col(31, s), dim = (s) => col(90, s), cyan = (s) => col(36, s);

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(path.relative(base, p));
  }
  return out;
}

/* ---------- restaurar ---------- */
if (flags.includes('--restaurar')) {
  const dirs = fs.existsSync(ROOT) ? fs.readdirSync(ROOT).filter((d) => d.startsWith('_backup_kortex_')).sort().reverse() : [];
  if (!dirs.length) { console.log(red('Nao encontrei nenhuma pasta _backup_kortex_* em ' + ROOT)); process.exit(1); }
  const bdir = path.join(ROOT, dirs[0]);
  walk(bdir).forEach((rel) => {
    const dst = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(bdir, rel), dst);
    console.log(green('  restaurado ') + rel);
  });
  console.log(green('\nPronto. Restaurado a partir de ' + dirs[0]));
  process.exit(0);
}

/* ---------- verificacoes iniciais ---------- */
if (!fs.existsSync(path.join(ROOT, 'src', 'main', 'main.js'))) {
  console.log(red('Nao encontrei src\\main\\main.js em: ' + ROOT));
  console.log('Corre este comando dentro da pasta EstudioK-Browser, ou passa o caminho:');
  console.log('  node .\\aplicar-loja-extensoes.js "C:\\Users\\Admin\\Desktop\\EstudioK-Browser"');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const BACKUP = path.join(ROOT, '_backup_kortex_' + stamp);
const stats = { ok: 0, already: 0, skipped: 0, missing: [], files: 0, restored: [] };

function backup(rel, buf) {
  const dst = path.join(BACKUP, rel);
  if (fs.existsSync(dst)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, buf);
}

function syntaxOk(full) {
  if (!/\.js$/.test(full)) return { ok: true };
  const r = cp.spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
  return { ok: r.status === 0, err: (r.stderr || '').split('\n').slice(0, 6).join('\n') };
}

/* ---------- motor de edicao ---------- */
function load(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  const buf = fs.readFileSync(full);
  let b = buf, bom = false;
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) { bom = true; b = buf.subarray(3); }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return { rel, full, bad: true }; }
  return { rel, full, buf, bom, text, eol: text.includes('\r\n') ? '\r\n' : '\n', changed: false };
}
const norm = (f, s) => s.replace(/\r?\n/g, f.eol);
const lineStart = (t, i) => t.lastIndexOf('\n', i - 1) + 1;
const lineEnd = (t, i) => { const j = t.indexOf('\n', i); return j < 0 ? t.length : j + 1; };
const indentOf = (t, i) => /^[ \t]*/.exec(t.slice(lineStart(t, i), i))[0];
const block = (f, text, ind) => text.split('\n').map((l) => (l.length ? ind + l : l)).join(f.eol);
function find(f, anchors) {
  for (const a of [].concat(anchors)) { const i = f.text.indexOf(a); if (i >= 0) return { i, a }; }
  return null;
}
function insertLine(f, at, ind, text, after) {
  const t = f.text;
  const ins = block(f, text, ind);
  if (after) {
    const le = lineEnd(t, at);
    f.text = (le === t.length && !t.endsWith('\n')) ? t + f.eol + ins : t.slice(0, le) + ins + f.eol + t.slice(le);
  } else {
    const ls = lineStart(t, at);
    f.text = t.slice(0, ls) + ins + f.eol + t.slice(ls);
  }
}
const OPS = {
  literal(f, op) {
    const h = find(f, op.anchor); if (!h) return 'missing';
    f.text = f.text.slice(0, h.i) + norm(f, op.text) + f.text.slice(h.i + h.a.length);
  },
  afterLine(f, op) { const h = find(f, op.anchor); if (!h) return 'missing'; insertLine(f, h.i, indentOf(f.text, h.i), op.text, true); },
  beforeLine(f, op) { const h = find(f, op.anchor); if (!h) return 'missing'; insertLine(f, h.i, indentOf(f.text, h.i), op.text, false); },
  beforeLineRegex(f, op) {
    const m = new RegExp(op.regex, op.flags || '').exec(f.text); if (!m) return 'missing';
    insertLine(f, m.index, indentOf(f.text, m.index), op.text, false);
  },
  regexReplace(f, op) {
    const m = new RegExp(op.regex, op.flags || '').exec(f.text); if (!m) return 'missing';
    const rep = norm(f, op.text.replace(/\{\{(\d)\}\}/g, (_, n) => m[Number(n)] || ''));
    f.text = f.text.slice(0, m.index) + rep + f.text.slice(m.index + m[0].length);
  },
  regexAppend(f, op) {
    const m = new RegExp(op.regex, op.flags || '').exec(f.text); if (!m) return 'missing';
    const e = m.index + m[0].length;
    f.text = f.text.slice(0, e) + norm(f, op.text) + f.text.slice(e);
  },
  cutTail(f, op) {
    const i = f.text.lastIndexOf(op.anchor); if (i < 0) return 'missing';
    const tail = f.text.slice(i + op.anchor.length);
    if (/ipcMain\.(handle|on|once)\(/.test(tail)) return 'unsafe';
    f.text = f.text.slice(0, lineStart(f.text, i)).replace(/\s*$/, '') + f.eol;
  },
  append(f, op) { f.text = f.text.replace(/\s*$/, '') + f.eol + f.eol + norm(f, op.text) + f.eol; }
};

console.log(cyan('\nKortex - loja de extensoes em: ') + ROOT + '\n');

/* ---------- 1) editar ficheiros existentes ---------- */
const pending = [];
for (const [rel, ops] of Object.entries(DATA.patches)) {
  console.log(cyan(rel));
  const f = load(rel);
  if (!f) { console.log(yellow('  [FICHEIRO NAO ENCONTRADO] ') + 'ignorado'); stats.missing.push(rel + ' (ficheiro nao existe)'); continue; }
  if (f.bad) { console.log(yellow('  [NAO ESTA EM UTF-8] ') + 'ignorado para nao estragar acentos'); stats.missing.push(rel + ' (codificacao)'); continue; }
  for (const op of ops) {
    if (op.marker && f.text.includes(op.marker)) { console.log(dim('  [ja aplicado] ' + op.label)); stats.already++; continue; }
    let res;
    try { res = OPS[op.type](f, op); } catch (e) { res = 'erro: ' + e.message; }
    if (!res) { console.log(green('  [ok] ') + op.label); stats.ok++; f.changed = true; }
    else if (res === 'missing' && op.optional) { console.log(dim('  [nada a fazer] ' + op.label)); stats.skipped++; }
    else { console.log(yellow('  [NAO APLICADO: ' + res + '] ') + op.label); stats.missing.push(op.label); }
  }
  if (f.changed) pending.push(f);
}

/* ---------- 2) escrever ficheiros editados (com backup + validacao) ---------- */
for (const f of pending) {
  const before = syntaxOk(f.full);
  backup(f.rel, f.buf);
  fs.writeFileSync(f.full, Buffer.concat([f.bom ? Buffer.from([0xEF, 0xBB, 0xBF]) : Buffer.alloc(0), Buffer.from(f.text, 'utf8')]));
  const after = syntaxOk(f.full);
  stats.files++;
  if (!after.ok && before.ok) {
    fs.writeFileSync(f.full, f.buf);
    stats.restored.push(f.rel);
    console.log(red('\n  ERRO de sintaxe em ' + f.rel + ' depois da edicao -> ficheiro RESTAURADO.\n') + after.err);
  } else if (!after.ok) {
    console.log(yellow('\n  Aviso: ' + f.rel + ' ja tinha erro de sintaxe antes desta edicao.\n') + after.err);
  }
}

/* ---------- 3) criar / atualizar ficheiros novos ---------- */
console.log(cyan('\nFicheiros novos'));
for (const [rel, b64] of Object.entries(DATA.files)) {
  const full = path.join(ROOT, rel);
  const buf = Buffer.from(b64, 'base64');
  const existed = fs.existsSync(full);
  if (existed && fs.readFileSync(full).equals(buf)) { console.log(dim('  [ja atualizado] ' + rel)); stats.already++; continue; }
  if (existed) backup(rel, fs.readFileSync(full));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  const chk = syntaxOk(full);
  if (!chk.ok) {
    if (existed) { fs.copyFileSync(path.join(BACKUP, rel), full); stats.restored.push(rel); }
    console.log(red('  [ERRO de sintaxe] ' + rel) + '\n' + chk.err);
    continue;
  }
  console.log(green(existed ? '  [atualizado] ' : '  [criado] ') + rel);
  stats.ok++; stats.files++;
}

/* ---------- resumo ---------- */
console.log('\n' + '='.repeat(60));
console.log(`${green('aplicado: ' + stats.ok)}   ${dim('ja estava: ' + stats.already)}   ${dim('nada a fazer: ' + stats.skipped)}   ${stats.missing.length ? yellow('com problema: ' + stats.missing.length) : green('com problema: 0')}`);
if (stats.missing.length) {
  console.log(yellow('\nEstes passos NAO foram aplicados (o ficheiro e diferente do esperado):'));
  stats.missing.forEach((m) => console.log('  - ' + m));
  console.log('Manda-me esta lista e o ficheiro em causa que eu ajusto.');
}
if (stats.restored.length) console.log(red('\nRestaurados por erro de sintaxe: ') + stats.restored.join(', '));
if (fs.existsSync(BACKUP)) console.log(dim('\nBackup dos originais em: ' + BACKUP + '\nPara desfazer: node .\\aplicar-loja-extensoes.js --restaurar'));
console.log(cyan('\nProximos passos:'));
console.log('  1. Fecha o Kortex por completo e abre de novo: npm run dev');
console.log('  2. Extensoes > "Chrome Web Store" (ou abre chromewebstore.google.com num separador).');
console.log('  3. Abre a pagina de uma extensao: aparece o botao laranja "Instalar no Kortex" no canto inferior direito.');
console.log('  4. Alternativa: Extensoes > cola o link ou o ID no campo "Instalar".\n');