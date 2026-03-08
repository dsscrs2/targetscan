/* ========================================
   AirScan — Export Module
   PDF, CSV, and Image export
   ======================================== */

const Export = {

    /**
     * Export session as PDF
     * Requires jsPDF loaded via CDN
     */
    async exportPDF(session, targetImageDataUrl) {
        if (typeof window.jspdf === 'undefined') {
            App.showToast('PDF library not loaded. Please check your connection.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Colors
        const green = [0, 204, 106];
        const dark = [10, 14, 23];
        const gray = [136, 153, 170];
        const white = [224, 230, 237];

        // Header background
        doc.setFillColor(...dark);
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Title
        doc.setTextColor(...green);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('AIRSCAN', 15, 18);

        doc.setFontSize(8);
        doc.setTextColor(...gray);
        doc.text('PRO · 0.177 AIR GUN ANALYTICS', 15, 25);

        // Date & target type
        const date = new Date(session.createdAt || session.date).toLocaleString();
        doc.setFontSize(9);
        doc.text(`Date: ${date}`, 15, 33);
        doc.text(`Target: ${session.targetType === 'air_pistol' ? 'Air Pistol 10m' : 'Air Rifle 10m'}`, pageWidth - 15, 33, { align: 'right' });

        let yPos = 50;

        // Target image
        if (targetImageDataUrl) {
            try {
                const imgSize = 80;
                const imgX = (pageWidth - imgSize) / 2;
                doc.addImage(targetImageDataUrl, 'PNG', imgX, yPos, imgSize, imgSize);
                yPos += imgSize + 10;
            } catch (e) {
                console.warn('Failed to add target image to PDF:', e);
            }
        }

        // Score Summary
        doc.setFillColor(15, 25, 35);
        doc.roundedRect(15, yPos, pageWidth - 30, 30, 3, 3, 'F');

        doc.setFontSize(28);
        doc.setTextColor(...green);
        doc.setFont('helvetica', 'bold');
        doc.text(`${session.totalScore}`, pageWidth / 2, yPos + 15, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(...gray);
        doc.text(`out of ${(session.shots || []).length * 10}`, pageWidth / 2, yPos + 24, { align: 'center' });

        yPos += 38;

        // Shot details table
        doc.setFontSize(11);
        doc.setTextColor(...white);
        doc.setFont('helvetica', 'bold');
        doc.text('SHOT DETAILS', 15, yPos);
        yPos += 6;

        // Table header
        doc.setFillColor(15, 25, 35);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.setFontSize(8);
        doc.setTextColor(...gray);
        doc.setFont('helvetica', 'bold');
        doc.text('Shot #', 20, yPos + 5.5);
        doc.text('Score', 50, yPos + 5.5);
        doc.text('Decimal', 75, yPos + 5.5);
        doc.text('X (mm)', 105, yPos + 5.5);
        doc.text('Y (mm)', 135, yPos + 5.5);
        doc.text('Dist (mm)', 165, yPos + 5.5);
        yPos += 8;

        // Table rows
        doc.setFont('helvetica', 'normal');
        (session.shots || []).forEach((shot, i) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            const rowColor = i % 2 === 0 ? [12, 20, 32] : [15, 25, 35];
            doc.setFillColor(...rowColor);
            doc.rect(15, yPos, pageWidth - 30, 7, 'F');

            doc.setFontSize(8);
            doc.setTextColor(...white);
            doc.text(`${i + 1}`, 20, yPos + 5);

            const scoreColor = shot.score >= 9 ? green : (shot.score >= 7 ? [255, 170, 0] : [255, 68, 102]);
            doc.setTextColor(...scoreColor);
            doc.text(`${shot.score}`, 50, yPos + 5);

            doc.setTextColor(...gray);
            doc.text(`${(shot.decimal || 0).toFixed(1)}`, 75, yPos + 5);
            doc.text(`${(shot.x || 0).toFixed(2)}`, 105, yPos + 5);
            doc.text(`${(shot.y || 0).toFixed(2)}`, 135, yPos + 5);
            doc.text(`${(shot.distance || 0).toFixed(2)}`, 165, yPos + 5);

            yPos += 7;
        });

        yPos += 8;

        // Analytics
        if (session.analytics) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }

            doc.setFontSize(11);
            doc.setTextColor(...white);
            doc.setFont('helvetica', 'bold');
            doc.text('ANALYTICS', 15, yPos);
            yPos += 8;

            const stats = [
                ['MPI Offset', `${Analytics.getMPIOffset(session.analytics.mpi).toFixed(2)} mm`],
                ['Mean Radius', `${session.analytics.meanRadius.toFixed(2)} mm`],
                ['Extreme Spread', `${session.analytics.extremeSpread.toFixed(2)} mm`],
                ['Group Size', `${session.analytics.groupSize.toFixed(2)} mm`],
                ['H. Dispersion', `${session.analytics.dispersion.horizontal.toFixed(2)} mm`],
                ['V. Dispersion', `${session.analytics.dispersion.vertical.toFixed(2)} mm`],
                ['Consistency', `${session.analytics.consistency.toFixed(2)} mm`]
            ];

            stats.forEach(([label, value], i) => {
                const rowColor = i % 2 === 0 ? [12, 20, 32] : [15, 25, 35];
                doc.setFillColor(...rowColor);
                doc.rect(15, yPos, pageWidth - 30, 7, 'F');
                doc.setFontSize(8);
                doc.setTextColor(...gray);
                doc.text(label, 20, yPos + 5);
                doc.setTextColor(...green);
                doc.text(value, pageWidth - 20, yPos + 5, { align: 'right' });
                yPos += 7;
            });
        }

        // AI Analysis
        if (session.aiTips && session.aiTips.length > 0) {
            yPos += 8;
            if (yPos > 240) { doc.addPage(); yPos = 20; }

            doc.setFontSize(11);
            doc.setTextColor(170, 102, 255);
            doc.setFont('helvetica', 'bold');
            doc.text('AI COACHING ANALYSIS', 15, yPos);
            yPos += 8;

            session.aiTips.forEach(tip => {
                if (yPos > 260) { doc.addPage(); yPos = 20; }
                doc.setFontSize(9);
                doc.setTextColor(...white);
                doc.setFont('helvetica', 'bold');
                doc.text(`${tip.icon} ${tip.title}`, 20, yPos);
                yPos += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...gray);
                const lines = doc.splitTextToSize(tip.description, pageWidth - 45);
                doc.text(lines, 20, yPos);
                yPos += lines.length * 4 + 4;
            });
        }

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text('Generated by AirScan · 0.177 Air Gun Analytics', pageWidth / 2, 290, { align: 'center' });

        // Save
        const filename = `AirScan_${session.targetType}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);
        App.showToast('PDF exported successfully!');
    },

    /**
     * Export shots as CSV
     */
    exportCSV(session) {
        const rows = [
            ['Shot #', 'Score', 'Decimal', 'X (mm)', 'Y (mm)', 'Distance (mm)', 'Inner 10']
        ];

        (session.shots || []).forEach((shot, i) => {
            rows.push([
                i + 1,
                shot.score,
                (shot.decimal || 0).toFixed(1),
                (shot.x || 0).toFixed(2),
                (shot.y || 0).toFixed(2),
                (shot.distance || 0).toFixed(2),
                shot.isInnerTen ? 'Yes' : 'No'
            ]);
        });

        // Add summary row
        rows.push([]);
        rows.push(['Total Score', session.totalScore || 0]);
        rows.push(['Max Possible', (session.shots || []).length * 10]);
        rows.push(['Target Type', session.targetType === 'air_pistol' ? 'Air Pistol 10m' : 'Air Rifle 10m']);
        rows.push(['Date', new Date(session.createdAt || session.date).toLocaleString()]);

        if (session.analytics) {
            rows.push([]);
            rows.push(['ANALYTICS']);
            rows.push(['MPI X (mm)', session.analytics.mpi.x.toFixed(2)]);
            rows.push(['MPI Y (mm)', session.analytics.mpi.y.toFixed(2)]);
            rows.push(['Mean Radius (mm)', session.analytics.meanRadius.toFixed(2)]);
            rows.push(['Extreme Spread (mm)', session.analytics.extremeSpread.toFixed(2)]);
            rows.push(['Group Size (mm)', session.analytics.groupSize.toFixed(2)]);
        }

        const csv = rows.map(row => row.join(',')).join('\n');
        this._downloadFile(csv, `AirScan_${session.targetType}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
        App.showToast('CSV exported successfully!');
    },

    /**
     * Export target image with shot overlay
     */
    exportImage(targetImageDataUrl) {
        if (!targetImageDataUrl) {
            App.showToast('No target image to export.', 'error');
            return;
        }

        const link = document.createElement('a');
        link.download = `AirScan_Target_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = targetImageDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.showToast('Image exported successfully!');
    },

    /**
     * Export all session data as JSON backup
     */
    exportBackup() {
        const data = Storage.exportAllData();
        this._downloadFile(data, `AirScan_Backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
        App.showToast('Backup exported successfully!');
    },

    /**
     * Import JSON backup
     */
    importBackup(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = Storage.importData(e.target.result);
            if (success) {
                App.showToast('Data imported successfully! Refreshing...');
                setTimeout(() => location.reload(), 1000);
            } else {
                App.showToast('Failed to import data. Check file format.', 'error');
            }
        };
        reader.readAsText(file);
    },

    // --- Helpers ---

    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
