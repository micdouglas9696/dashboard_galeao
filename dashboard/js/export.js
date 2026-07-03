/**
 * SESCINC SBGL Dashboard — Export
 * PNG and PDF export using html2canvas and jsPDF
 */
(function () {
  'use strict';

  window.SESCINC = window.SESCINC || {};

  /* ── Toast ── */

  function showToast(message, type) {
    type = type || 'success';
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = 'toast toast-' + type + ' toast-show';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('toast-show');
    }, 3000);
  }

  /* ── Helpers ── */

  function getDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getSectionName(sectionId) {
    // sectionId = "section-taf" → "taf"
    return (sectionId || '').replace('section-', '') || 'dashboard';
  }

  function getSectionTitle(sectionId) {
    const names = {
      'section-overview': 'Visão Geral',
      'section-taf': 'TAF — Teste de Aptidão Física',
      'section-tpepr': 'TP-EPR — Teste Prático EPR',
      'section-tr': 'TR — Tempo de Resposta',
      'section-teorica': 'Avaliação Teórica',
      'section-upload': 'Upload de Dados',
      'section-manual': 'Entrada Manual'
    };
    return names[sectionId] || 'Dashboard';
  }

  /* ── Export to PNG ── */

  async function toPNG(sectionId) {
    console.log('[Export] Exporting PNG for:', sectionId);
    const section = document.getElementById(sectionId);
    if (!section) {
      showToast('Seção não encontrada.', 'error');
      return;
    }

    try {
      if (typeof html2canvas === 'undefined') {
        showToast('html2canvas não está carregado.', 'error');
        return;
      }

      const canvas = await html2canvas(section, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY
      });

      const link = document.createElement('a');
      link.download = `dashboard-${getSectionName(sectionId)}-${getDateStr()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      showToast('Imagem exportada com sucesso!', 'success');
    } catch (err) {
      console.error('[Export] PNG error:', err);
      showToast('Erro ao exportar imagem.', 'error');
    }
  }

  /* ── Export to PDF ── */

  async function toPDF(sectionId) {
    console.log('[Export] Exporting PDF for:', sectionId);
    const section = document.getElementById(sectionId);
    if (!section) {
      showToast('Seção não encontrada.', 'error');
      return;
    }

    try {
      if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        showToast('Bibliotecas de exportação não estão carregadas.', 'error');
        return;
      }

      // Check if there is a table wrapper
      const tableWrapper = section.querySelector('.table-wrapper') || section.querySelector('.table-scroll');
      let headers = [];
      let rows = [];

      // Extract table data and temporarily hide it to keep page 1 charts-only
      if (tableWrapper) {
        tableWrapper.querySelectorAll('thead th').forEach(th => headers.push(th.textContent.trim()));
        tableWrapper.querySelectorAll('tbody tr').forEach(tr => {
          const row = [];
          tr.querySelectorAll('td').forEach(td => row.push(td.textContent.trim()));
          if (row.length && row.some(cell => cell !== '')) {
            rows.push(row);
          }
        });

        // Hide table to render charts cleanly on Page 1
        tableWrapper.style.display = 'none';
      }

      const canvas = await html2canvas(section, {
        backgroundColor: '#05050e', // Matched premium dark background
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY
      });

      // Restore table if we hid it
      if (tableWrapper) {
        tableWrapper.style.display = '';
      }

      const { jsPDF } = jspdf;
      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape A4

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header on Page 1
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(226, 232, 240); // Lighter text color matched dark theme
      pdf.setFillColor(12, 13, 32); // Darker box header background
      pdf.rect(0, 0, pageWidth, 28, 'F');
      
      pdf.text('SESCINC — SBGL (Rio Galeão)', margin, margin + 2);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184);
      pdf.text(getSectionTitle(sectionId), margin, margin + 8);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - margin - 80, margin + 8);

      // Add charts image to Page 1
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const availableHeight = pageHeight - margin * 2 - 20;
      const finalHeight = Math.min(imgHeight, availableHeight);
      
      pdf.setFillColor(5, 5, 14); // Dark background fill
      pdf.rect(0, 28, pageWidth, pageHeight - 28, 'F');
      pdf.addImage(imgData, 'PNG', margin, margin + 18, imgWidth, finalHeight);

      // Draw vector table on subsequent pages if data exists
      if (headers.length && rows.length) {
        pdf.addPage();
        
        const availableWidth = pageWidth - margin * 2;
        const colWidths = [];
        const nameWidth = availableWidth * 0.25; // 25% for Name/first column
        const otherWidth = (availableWidth - nameWidth) / (headers.length - 1);
        for (let i = 0; i < headers.length; i++) {
          colWidths.push(i === 0 ? nameWidth : otherWidth);
        }

        let y = margin + 15;

        // Draw page title
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(15, 23, 42); // Black text for vector page
        pdf.text(`${getSectionTitle(sectionId)} — Registros`, margin, margin + 2);

        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, y - 6, availableWidth, 9, 'F');
        pdf.setTextColor(71, 85, 105);

        // Draw headers
        let currentX = margin;
        headers.forEach((h, idx) => {
          pdf.text(h, currentX + 2, y);
          currentX += colWidths[idx];
        });

        y += 9;

        // Draw rows
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);

        rows.forEach((row, rIdx) => {
          // Check for page overflow (keep safe margin at bottom)
          if (y > pageHeight - margin - 12) {
            // Footer of current page
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text(`Página ${pdf.internal.getNumberOfPages()}`, pageWidth - margin - 20, pageHeight - margin + 4);

            pdf.addPage();
            y = margin + 15;

            // Draw header again
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, y - 6, availableWidth, 9, 'F');
            pdf.setTextColor(71, 85, 105);

            let headerX = margin;
            headers.forEach((h, idx) => {
              pdf.text(h, headerX + 2, y);
              headerX += colWidths[idx];
            });

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            y += 9;
          }

          // Alternating row backgrounds
          if (rIdx % 2 === 0) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, y - 5, availableWidth, 8, 'F');
          }

          let cellX = margin;
          row.forEach((cell, cIdx) => {
            const cellText = String(cell || '');
            
            // Text color highlight based on outcome
            if (cellText === 'Satisfatório' || cellText === 'Excelente' || cellText === 'OK') {
              pdf.setTextColor(22, 163, 74); // Vibrant Green
              pdf.setFont('helvetica', 'bold');
            } else if (cellText === 'Insatisfatório' || cellText === 'Ruim') {
              pdf.setTextColor(220, 38, 38); // Luminous Red
              pdf.setFont('helvetica', 'bold');
            } else if (cellText === 'Bom') {
              pdf.setTextColor(217, 119, 6); // Warm Amber
              pdf.setFont('helvetica', 'bold');
            } else {
              pdf.setTextColor(15, 23, 42); // Normal dark slate
              pdf.setFont('helvetica', 'normal');
            }

            // Clip text if it overflows cell width
            let textToDraw = cellText;
            const textWidth = pdf.getTextWidth(textToDraw);
            const cellLimit = colWidths[cIdx] - 4;
            if (textWidth > cellLimit) {
              textToDraw = pdf.splitTextToSize(textToDraw, cellLimit)[0] + '...';
            }

            pdf.text(textToDraw, cellX + 2, y);
            cellX += colWidths[cIdx];
          });

          y += 8;
        });

        // Add page number to the last page
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Página ${pdf.internal.getNumberOfPages()}`, pageWidth - margin - 20, pageHeight - margin + 4);
      } else {
        // Footer for single-page dashboard
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Página 1`, pageWidth - margin - 20, pageHeight - margin + 4);
      }

      pdf.save(`dashboard-${getSectionName(sectionId)}-${getDateStr()}.pdf`);
      showToast('PDF exportado com sucesso!', 'success');
    } catch (err) {
      console.error('[Export] PDF error:', err);
      showToast('Erro ao exportar PDF.', 'error');
    }
  }

  window.SESCINC.Export = { toPNG, toPDF, showToast };
})();
