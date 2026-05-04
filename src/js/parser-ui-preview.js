  /**
   * Show preview table with data
   * Only shows configured columns and limits to 5 rows
   */
  static showPreview(preview, userColumns) {
    const previewSection = document.getElementById('previewSection');
    if (!previewSection) return;

    // Only show if there are user columns configured
    if (!userColumns || userColumns.length === 0) {
      previewSection.style.display = 'none';
      return;
    }

    if (!preview || preview.length === 0) {
      previewSection.style.display = 'none';
      return;
    }

    previewSection.style.display = 'block';

    const table = document.getElementById('previewTable');
    if (!table) return;

    table.innerHTML = '';

    // Create header with only configured columns
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    userColumns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.name;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body with only first 5 rows and configured columns
    const tbody = document.createElement('tbody');
    const maxRows = Math.min(5, preview.length);
    for (let i = 0; i < maxRows; i++) {
      const row = preview[i];
      const tr = document.createElement('tr');
      userColumns.forEach(col => {
        const td = document.createElement('td');
        td.textContent = row[col.name] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }
