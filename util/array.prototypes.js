if (!Array.prototype.joinReplaceLast) {
  Array.prototype.joinReplaceLast = function (separator, last) {
    const str = this.join(separator);

    if (!separator) {
      return str;
    }

    const lastIndexOfSeparator = str.lastIndexOf(separator);

    if (lastIndexOfSeparator === -1) {
      return str;
    }

    return str.slice(0, lastIndexOfSeparator) + ` ${last} ` + str.slice(lastIndexOfSeparator + separator.length);
  };
}
