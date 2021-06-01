/**
 * Creates a svg chart with given dataset. The chart takes the width of the elementParent
 * @param elementParent {HTMLElement} the element in which the chart will be output
 * @param dataset {Object} the data which will be displayed in the chart
 * @param id {String} the id of the chart element
 * @param lineColor {String} the color of the line
 * @param heightRatio {Number} the height will be the width multiplied by this coefficient
 * @param gridColor {String} the color of the axes
 * @deprecated not updated yet
 */
export function createChart(elementParent: HTMLElement, dataset: any, id: string, lineColor: string, heightRatio: number, gridColor: string = "#ffffff"): void {
    const dataKeys = <any>Object.keys(dataset);
    if (dataKeys.length === 0)
        return;
    let highestPoint = 0;
    for (let i in dataKeys) {
        if (dataset[i] > highestPoint)
            highestPoint = dataset[i];
    }
    const width = parseInt(window.getComputedStyle(elementParent).width.slice(0, -2));
    const height = heightRatio * width;
    const scaleX = (width - 30) / dataKeys[dataKeys.length - 1];
    const scaleY = (height - 30) / highestPoint;
    const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chart.id = id;
    chart.innerHTML = `
        <line x1="15" y1="${height - 15}" x2="${width - 15}" y2="${height - 15}" style="stroke:${gridColor};stroke-width:1"/>
        <line x1="15" y1="15" x2="15" y2="${height - 15}" style="stroke:${gridColor};stroke-width:1"/>
        unable to display chart
    `;
    let latestPoint: any;
    Object.keys(dataset).forEach(function (x) {
        chart.innerHTML += `<circle cx="${15 + scaleX * parseInt(x)}" cy="${height - 15 - parseInt(dataset[x]) * scaleY}" r="3" stroke="${lineColor}" stroke-width="1" fill="${gridColor}"/>`;
        if (latestPoint != null)
            chart.innerHTML += `<line x1="${15 + scaleX * latestPoint[0]}" y1="${height - 15 - scaleY * latestPoint[1]}" x2="${15 + scaleX * parseInt(x)}" y2="${height - 15 - scaleY * parseInt(dataset[x])}" stroke-width="1" stroke="${lineColor}"/>`;
        latestPoint = [parseInt(x), parseInt(dataset[x])];
    });
    let scaleSysX = 0, scaleSysY = 0;
    while (scaleSysX <= width - 30) {
        chart.innerHTML += `<text x="${10 + scaleSysX}" y="${height}" font-family="sans-serif" font-size="10px" fill="${gridColor}">${scaleSysX / scaleX > 10 ? Math.round(scaleSysX / scaleX) : Math.round(scaleSysX / scaleX * 100) / 100}</text>`;
        scaleSysX += scaleX * dataKeys[dataKeys.length - 1] / 10
    }
    while (scaleSysY <= height - 30) {
        chart.innerHTML += `<text x="0" y="${height - 10 - scaleSysY}" font-family="sans-serif" font-size="10px" fill="${gridColor}">${scaleSysY / scaleY > 10 ? Math.round(scaleSysY / scaleY) : Math.round(scaleSysY / scaleY * 100) / 100}</text>`;
        scaleSysY += scaleY * highestPoint / 10
    }
    chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    chart.setAttribute('preserveAspectRatio', 'xMinyMin meet');
    elementParent.appendChild(chart);
}