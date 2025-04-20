if (!Array.prototype.joinReplaceLast) {
  Array.prototype.joinReplaceLast = function (separator, last) {
    const lastOccurrenceRegexp = new RegExp(`${separator} ([^${separator}]*)$`);
    return this.join(`${separator} `).replace(lastOccurrenceRegexp, ` ${last} $1`);
  };
}
