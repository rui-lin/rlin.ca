var demo = new function() {
  /* Common vars */
  var maingraph, overview;
  var TOTAL_WIDTH, TOTAL_HEIGHT;
  var CANVAS_WIDTH, CANVAS_HEIGHT;

  /* Entry point */
  this.init = function() {
    d3.csv("data.csv")
      .row(function(d){ return{x: +d.x, y: +d.y}; })
      .get(function(error, rows){ demo.initGraph(rows); });
  }

  /* Graph initialization */
  this.initGraph = function(data) {
    container = d3.select("#graph_container");
    TOTAL_WIDTH = container.property('clientWidth');
    TOTAL_HEIGHT = container.property('clientHeight');
    CANVAS_WIDTH = TOTAL_WIDTH;
    CANVAS_HEIGHT = TOTAL_HEIGHT;

    maingraph = new LineGraph('#graph_container', {
      'id': 'maingraph',
              'data': data,
              'width': CANVAS_WIDTH,
              'height': CANVAS_HEIGHT * 0.85,
              'xlabel': 'Time',
              'ylabel': 'Value',
              'xticks': 8,
              'padding_top': 30,
              'hasbrush' : true,
              'useforegroundbrush' : false
    });
    overview = new LineGraph('#graph_container', {
      'id': 'overview',
             'data': data,
             'width': CANVAS_WIDTH,
             'height': CANVAS_HEIGHT * 0.15,
             'padding_top': 0,
             'noyaxis': true,
             'hasbrush' : true,
             'hasbrushhandles' : true
    });

    setupOverviewGraph();
    setupMainGraph();
  }

  function setupOverviewGraph() {
    overview.background.attr('class', 'overview grid background');
    var filter = overview.svg.append("defs")
      .append("filter")
      .attr("id", "blur")
      .append("feGaussianBlur")
      .attr("stdDeviation", 1);
    var leftshader = overview.svg.select('.brush').insert('rect', '.extent')
      .attr('class', 'shader')
      .attr("filter", "url(#blur)")
      .attr('height', overview.options.height)
      .attr('y', 0);
    var rightshader = overview.svg.select('.brush').insert('rect', '.extent')
      .attr('class', 'shader')
      .attr("filter", "url(#blur)")
      .attr('height', overview.options.height)
      .attr('y', 0);

    overview.xAxis.orient('top');
    overview.xAxisg.call(overview.xAxis);
    overview.brush
      .on("brush", brushmove)
      .on("brushstart", brushstart)
      .on("brushend", brushend)
      .extent([0, (overview.options.maxx-overview.options.minx)/4+overview.options.minx]);
    overview.brushg
      .attr('class', 'brush white')
      .call(overview.brush)
      .call(overview.brush.event);

    var hasMoveEvent = false;
    var runningUpdateThread = false;
    function runUpdateThread() {
      if (hasMoveEvent) {
        // console.log ("updating");
        updateMainGraph();
        hasMoveEvent = false;
      }
      if (runningUpdateThread)
        window.setTimeout(runUpdateThread, 300);
    }
    function brushstart() {
      runningUpdateThread = true;
      runUpdateThread();
    }
    function brushend() {
      runningUpdateThread = false;
      hasMoveEvent = false;
      updateMainGraph();
    }
    function brushmove() {
      hasMoveEvent = true;
      leftshader.attr('width', overview.xScale(overview.brush.extent()[0]));
      rightshader.attr('x', overview.xScale(overview.brush.extent()[1]));
      rightshader.attr('width', overview.options.width - overview.xScale(overview.brush.extent()[1]));
    }
    function updateMainGraph() {
      // Update domain of main graph, adjust data and xaxis
      var oldx = maingraph.xScale.domain();
      var newx = overview.brush.empty() ? overview.xScale.domain() : overview.brush.extent();
      var changedRatio = Math.max(Math.abs(newx[0] - oldx[0]), Math.abs(newx[1] - oldx[1])) /
        (oldx[1] - oldx[0]);

      if (changedRatio == 0)
        return;

      var transTime = Math.max(200, Math.min(300, changedRatio * 300));

      maingraph.xScale.domain(newx);

      path = maingraph.svg.select('.plot');
      if (transTime > 0)
        path = path.transition().duration(transTime).ease("linear");
      path.attr('d', maingraph.lineFunc(maingraph.options.data));

      xaxis = maingraph.svg.select(".x.axis");
      if (transTime > 0)
        xaxis = xaxis.transition().duration(transTime).ease("linear");
      xaxis.call(maingraph.xAxis);

      selections = maingraph.svg.selectAll('.selection')
        .transition().duration(transTime).ease('linear')
        .attr('x', function() { return maingraph.xScale(this.getAttribute('datax1')); })
        .attr('width', function(){ 
          if (this.hasAttribute('datax2')) {
            return (maingraph.xScale(this.getAttribute('datax2')) -
              maingraph.xScale(this.getAttribute('datax1')));
          } else {
            return this.getAttribute('width');
          }
        });
    }
  }

  function setupMainGraph() {
    maingraph.brush
      .on("brushend", brushend);
    maingraph.brushg
      .attr("class", "brush normal")
      .call(maingraph.brush);

   function brushend() {
      var extent = maingraph.brush.extent();
      var extentWidth = extent[1] - extent[0];
      var rangeExtent = [maingraph.xScale(extent[0]), maingraph.xScale(extent[1])];
      var rangeWidth = rangeExtent[1] - rangeExtent[0];

      // Clear brush
      maingraph.brush.clear();
      maingraph.svg.select('.brush').call(maingraph.brush);

      // Only 2 pixels wide, just a click
      if (rangeWidth < 5)
        return;

      // Create highlight in overview
      var overview_selection = overview.svg.select('.plotview')
        .append('rect')
        .attr('class', 'highlight')
        .attr('x', overview.xScale(extent[0]))
        .attr('y', 0)
        .attr('width', overview.xScale(extent[1]) - overview.xScale(extent[0]))
        .attr('height', overview.options.height);

      // Create selection 
      var selection = maingraph.svg.select('.plotview').append('g')
        .attr('class', 'selection')
        .on('mouseenter', mouseenter_rect)
        .on('mouseleave', mouseleave_rect);
      var rect = selection.append('rect')
        .attr('class', 'selection rect')
        .attr('datax1', extent[0])
        .attr('datax2', extent[1])
        .attr('x', rangeExtent[0])
        .attr('y', 1)
        .attr('width', rangeWidth)
        .attr('height', maingraph.options.height);
      var cross = selection.append('text')
        .attr('class', 'selection cross')
        .attr('datax1', extent[1])
        .attr('x', rangeExtent[1])
        .attr('y', 0)
        .attr('dy', '0.9em')
        .attr('dx', '-0.3em')
        .on('click', deleteSelection)
        .text("x");
      tagy = maingraph.options.height * 1/3 + maingraph.options.padding.top;
      tagx_data = (extent[0] + extent[1])/2;
      tagx = maingraph.xScale(tagx_data);
      var tag = selection.append("text")
        .attr('class', 'selection tag')
        .attr('datax1', tagx_data)
        .attr("x", tagx)
        .attr("y", tagy)
        .on('click', showEditBox);
      var hasTag = false;
      var editting = true;
      var mousein = false;

      showEditBox();

      function mouseenter_rect() {
        mousein = true;
        check_showtagprompt();
      }
      function mouseleave_rect() {
        mousein = false;
        check_hidetagprompt();
      }
      function check_showtagprompt() {
        if (editting) return;
        if (mousein && tag.text().trim() == "") {
          hasTag = false;
          tag
            .style('opacity', 0)
            .text("[Click here to add a tag]")
            .transition().duration(200)
            .style('opacity', 1);
        }
      }
      function check_hidetagprompt() {
        if (!hasTag) {
          tag
            .transition().duration(200)
            .style('opacity', 0)
            .transition()
            .text("");
        }
      }
      function showEditBox() {
        var extent = [rect.attr('datax1'), rect.attr('datax2')];
        var extentWidth = extent[1] - extent[0];
        var rangeExtent = [maingraph.xScale(extent[0]), maingraph.xScale(extent[1])];
        var rangeWidth = rangeExtent[1] - rangeExtent[0];

        var width = Math.max(80, rangeWidth*0.8);
        var left = (rangeExtent[0] + rangeExtent[1])/2 - width/2 + maingraph.options.padding.left - 3;
        var top = maingraph.options.height * 1/3 + maingraph.options.padding.top + 8;
        var editBox = d3.select('#maingraph')
          .append('input')
          .attr('class', 'tag input')
          .style('left', left + 'px')
          .style('top', top + 'px')
          .style('position', 'absolute')
          .attr('value', tag.text())
          .on("blur", blur)
          .on("keydown", keydown)
          .style('width', width + 'px')
          .node();
        editBox.focus();
        editBox.select();
        editting = true;
      }
      function hideEditBox(obj) {
          obj.parentNode.removeChild(obj);
          editting = false;
      }
      function blur() {
        updateTag(this, allowEmpty=false);
      }
      function keydown() {
        e = d3.event || window.event;
        if (e.keyCode == 13) { // enter
          updateTag(this);
        } else if (e.keyCode == 27) { // esc
          hideEditBox(this);
        }
      }
      function updateTag(obj, allowEmpty) {
        if (allowEmpty === undefined) allowEmpty = true;
        hasTag = true;
        if (allowEmpty || obj.value.trim() != "")
          tag.text(obj.value).style('opacity', 1);
        hideEditBox(obj);
        check_showtagprompt();
      }
      function deleteSelection() {
        selection.remove();
        overview_selection.remove();
      }
    }
  }
}

/*
 * Creates a basic line graph with some options
 * Properties
 *  svg
 *  options
 *  xScale, yScale
 *  xAxis, yAxis
 */
LineGraph = function(container, options) {
    var self = this;
    options = options || {};
    options.id = options.id || "";
    options.data = options.data || {};
    options.total_width = options.width || CANVAS_WIDTH;
    options.total_height = options.height || 50;
    options.xlabel = options.xlabel || "";
    options.ylabel = options.ylabel || "";
    options.xticks = options.xticks || 5;
    options.yticks = options.yticks || 6;
    options.padding = {
      "top":    options.padding_top || 20,
      "right":  30,
      "bottom": options.xlabel ? 60 : 20,
      "left":   80 // options.ylabel ? 70 : 45
    }
    options.width = options.total_width - options.padding.left - options.padding.right;
    options.height = options.total_height - options.padding.top - options.padding.bottom;
    options.minx = Math.min(0, d3.min(options.data, function(d){return d.x}));
    options.maxx = d3.max(options.data, function(d){return d.x});
    options.miny = Math.min(0, d3.min(options.data, function(d){return d.y}));
    options.maxy = d3.max(options.data, function(d){return d.y});
    if (options.noxaxis === undefined) options.noxaxis = false;
    if (options.noyaxis === undefined) options.noyaxis = false;
    if (options.hasbrush === undefined) options.hasbrush = true;
    if (options.hasbrushhandles === undefined) options.hasbrushhandles = false;
    if (options.useforegroundbrush === undefined) options.useforegroundbrush = true;
    this.options = options;

    console.debug("creating graph with options", options);

    // Create svg
    this.svg = d3.select(container)
      .append('div')
      .attr("id", options.id)
      .attr("class", 'graph')
      .append("svg")
      .attr("width", options.total_width)
      .attr("height", options.total_height)
      .append('g')
      .attr('transform','translate(' + options.padding.left + ',' + options.padding.top + ' )')
      .attr('width', options.width)
      .attr('height', options.height);

    this.background = this.svg.append('rect')
      .attr('width', options.width)
      .attr('height', options.height)
      .attr('class', 'grid background');

    this.svg.append('defs')
      .append('clipPath')
      .attr('id', options.id + '-clipper')
      .append('rect')
      .attr('width', options.width)
      .attr('height', options.height);

    // Create scales
    this.xScale = d3.scale.linear()
      .range([0, options.width])
      .domain([options.minx, options.maxx]);
    this.yScale = d3.scale.linear()
      .range([options.height, 0])
      .domain([options.miny, options.maxy]);

    // Create and plot axes
    if (!options.noxaxis) {
      this.xAxis = d3.svg.axis()
        .scale(this.xScale)
        .ticks(options.xticks);
      this.xAxisg = this.svg.append('svg:g') // use g here
        .attr('transform', 'translate(0,' + options.height + ' )')
        .attr("class", "x axis")
        .call(this.xAxis);
      this.svg.append('text')
        .attr("x", options.width/2)
        .attr("y", options.height)
        .attr("dy", "2.5em")
        .style("text-anchor", "middle")
        .text(options.xlabel);
    }
    if (!options.noyaxis) {
      this.yAxis = d3.svg.axis()
        .orient('left')
        .scale(this.yScale)
        .ticks(options.yticks);
      this.yAxisg = this.svg.append('svg:g')
        .attr("class", "y axis")
        .call(this.yAxis);
      this.svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0)
        .attr("x", 0 - options.height / 2)
        .attr("dy", "-2.2em")
        .style("text-anchor", "middle")
        .text(options.ylabel);
    }

    // Create view clipper for plot items (so they don't go past bounds of axes)
    // Create and plot line on plotview
    this.lineFunc = d3.svg.line()
      .x(function(d) {return self.xScale(d.x);})
      .y(function(d) {return self.yScale(d.y);})
      .interpolate('linear');
    var clipper = this.svg.append('g')
      .attr('class', 'plotview')
      .attr('clip-path', 'url(#' + options.id + '-clipper)')
      .append('svg:path')
      .attr('d', this.lineFunc(options.data))
      .attr('class', 'plot');

    // Create brush on clipper (background) or directly on svg (foreground)
    if (options.hasbrush) {
      this.brush = d3.svg.brush()
        .x(this.xScale);
      if (options.useforegroundbrush) {
        this.brushg = this.svg.append("g");
      } else {
        this.brushg = this.svg.insert("g", ".plotview");
      }
      this.brushg
        .attr("class", "brush")
        .call(this.brush)
        .selectAll('rect')
        .attr('height', options.height);
      if (options.hasbrushhandles) {
        var arc = d3.svg.arc()
          .outerRadius( options.height / 2)
          .startAngle(0)
          .endAngle(function(d, i) { return i ? -Math.PI : Math.PI; });
        this.brushg.selectAll(".resize").append("path")
          .attr("transform", "translate(0," +  options.height / 2 + ")")
          .attr("d", arc);
      }
    }
}
