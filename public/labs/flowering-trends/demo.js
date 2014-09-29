var demo = new function() {
  /* Common vars */
  var maingraph, overview;
  var TOTAL_WIDTH, TOTAL_HEIGHT;
  var CANVAS_WIDTH, CANVAS_HEIGHT;
  var parseDate = d3.time.format("%m/%d/%Y").parse;
  var parseDate2 = d3.time.format("%j").parse;
  var parseCSV = function(file, callback) {
    d3.csv(file)
      .row(function(d){ 
        if (+d['Num_Flowers'] <= 0) return null;
        return{
          species_name: d['Species_Name'],
        date: parseDate(d['Date(MM/DD/YYYY)']),
        day: parseDate2(d['Julien_Day']),
        num_flowers: +d['Num_Flowers'],
        contributor_id: +d['Contributor_ID']};
        })
      .get(callback);
  }
  contributor_id = 1;

  /* Entry point */
  this.init = function() {
    var data = [];
    parseCSV("data1.csv", function(error, rows) {
      data.push(rows);
      parseCSV("data2.csv", function(error, rows) {
        data.push(rows);
        demo.initGraph(data);
      });
    });
  }

  /* Graph initialization */
  this.initGraph = function(data) {
    container = d3.select("#graph_container");
    TOTAL_WIDTH = container.property('clientWidth');
    TOTAL_HEIGHT = container.property('clientHeight');
    CANVAS_WIDTH = TOTAL_WIDTH;
    CANVAS_HEIGHT = TOTAL_HEIGHT;

    maingraph = new ScatterPlot('#graph_container', {
      'id': 'maingraph',
              'data': data,
              'width': CANVAS_WIDTH,
              'height': CANVAS_HEIGHT * 0.85,
              'xlabel': 'Date',
              'ylabel': 'Earliest Flowering Day',
              'xticks': 5,
              'padding_top': 30,
              'hasbrush' : false,
              'hastooltip' : true
    });
    overview = new ScatterPlot('#graph_container', {
      'id': 'overview',
             'data': data,
             'width': CANVAS_WIDTH,
             'height': CANVAS_HEIGHT * 0.15,
             'padding_top': 0,
             'noyaxis': true,
             'hasbrush' : true,
             'hasbrushhandles' : true,
             'has_hgrid': false,
             'haslegend': false
    });

    setupOverviewGraph();
    setupMainGraph();
  }

  this.addRecord = function(datum) {
    datum.date = parseDate(datum.date);
    datum.day = parseDate2(datum.day);
    datum.num_flowers = +datum.num_flowers;
    datum.contributor_id = +datum.contributor_id;
    var bisect = d3.bisector(function(d){return d.date;}).left;
    [overview, maingraph].forEach(function(graph) {
      var found=false;
      graph.options.data.forEach(function(g) {
        if (g[0].species_name == datum.species_name) {
          found=true;
          // console.log("found inserting at", bisect(g, datum.date), "of", g);
          g.splice(bisect(g, datum.date), 0, datum);
        }});
      if (!found) {
        // console.log("not found");
        graph.options.data.push([datum]);
        // console.log(graph.options.data);
      }
      graph.updateSomeOptions();
      graph.yScale.domain([graph.options.miny, graph.options.maxy]);
      graph.xScale.domain([graph.options.minx, graph.options.maxx]);
      graph.updatePlot();

      // console.log("updating",graph);
    });
    // overview.updateSomeOptions();
    // overview.xScale.domain([overview.options.minx, overview.options.maxx]);
    // overview.updatePlot();
    overview.svg.select(".x.axis")
      .transition().duration(200).ease("linear")
      .call(overview.xAxis);
    maingraph.svg.select(".y.axis")
      .transition().duration(200).ease("linear")
      .call(maingraph.yAxis);
    overview.brushg
      .call(overview.brush.event);
    // setupOverviewGraph.updateMainGraph();
  }

  function setupOverviewGraph() {
    overview.background.attr('class', 'overview grid background');
    var filter = overview.svg.append("defs")
      .append("filter")
      .attr("id", "blur")
      .attr( 'x','-50%' )
      .attr( 'y','-50%' )
      .attr( 'width','200%' )
      .attr( 'height','200%' )
      .append("feGaussianBlur")
      // .attr( 'in', 'SourceAlpha' )
      .attr( 'stdDeviation', 1.5 ) // !!! important parameter - blur
      // .attr( 'result', 'blur' );


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
      // .extent([0, d3.interpolate(overview.options.minx, overview.options.maxx)(0.5)]);
    overview.brushg
      .attr('class', 'brush white')
      .call(overview.brush)
      .call(overview.brush.event);

    var hasMoveEvent = false;
    var runningUpdateThread = false;
    function runUpdateThread() {
      if (hasMoveEvent) {
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

      maingraph.xScale.domain(newx);
      maingraph.updatePlot();
      maingraph.svg.select(".x.axis")
        .transition().duration(200).ease("linear")
        .call(maingraph.xAxis);
    }
  }

  function setupMainGraph() {
  }
}

/*
 * Creates a basic scatter plot with some options
 * data is now an array of data (each a series)
 * Properties
 *  svg
 *  options
 *  xScale, yScale
 *  xAxis, yAxis
 */
ScatterPlot = function(container, options) {
    var self = this;
    options = options || {};
    options.id = options.id || "";
    options.data = options.data || {};
    options.total_width = options.width || CANVAS_WIDTH;
    options.total_height = options.height || 50;
    options.xlabel = options.xlabel || "";
    options.ylabel = options.ylabel || "";
    options.xticks = options.xticks || 5;
    options.yticks = options.yticks || 5;
    options.padding = {
      "top":    options.padding_top || 20,
      "right":  30,
      "bottom": options.xlabel ? 60 : 20,
      "left":   120 // options.ylabel ? 70 : 45
    }
    options.width = options.total_width - options.padding.left - options.padding.right;
    options.height = options.total_height - options.padding.top - options.padding.bottom;
    findminx = function(g){ return d3.min(g, function(d){ return d.date; }); };
    findmaxx = function(g){ return d3.max(g, function(d){ return d.date; }); };
    findminy = function(g){ return d3.min(g, function(d){ return d.day; }); };
    findmaxy = function(g){ return d3.max(g, function(d){ return d.day; }); };
    options.minx = d3.min(options.data, findminx);
    options.maxx = d3.max(options.data, findmaxx);
    options.miny = d3.min(options.data, findminy);
    options.maxy = d3.max(options.data, findmaxy);
    options.circler = Math.min(10,options.height/10);
    if (options.noxaxis === undefined) options.noxaxis = false;
    if (options.noyaxis === undefined) options.noyaxis = false;
    if (options.hasbrush === undefined) options.hasbrush = true;
    if (options.hasbrushhandles === undefined) options.hasbrushhandles = false;
    if (options.useforegroundbrush === undefined) options.useforegroundbrush = true;
    if (options.has_hgrid === undefined) options.has_hgrid = true;
    if (options.haslegend === undefined) options.haslegend = true;
    if (options.hastooltip === undefined) options.hastooltip = false;
    this.options = options;

    this.updateSomeOptions = function() {
      options.minx = d3.min(options.data, findminx);
      options.maxx = d3.max(options.data, findmaxx);
      options.miny = d3.min(options.data, findminy);
      options.maxy = d3.max(options.data, findmaxy);
    }

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
    this.xScale = d3.time.scale()
      .range([options.circler, options.width - options.circler])
      .domain([options.minx, options.maxx]);
    this.yScale = d3.time.scale()
      .range([options.height - options.circler, options.circler])
      // .range([options.circler, options.height - options.circler])
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
        .ticks(options.yticks)
        .tickFormat(d3.time.format("%b"));
      this.yAxisg = this.svg.append('svg:g')
        .attr("class", "y axis")
        .call(this.yAxis);
      this.svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0)
        .attr("x", 0 - options.height / 2)
        .attr("dy", "-3.8em")
        .style("text-anchor", "middle")
        .text(options.ylabel);
    }

    if (options.has_hgrid) {
      this.svg.selectAll("line.horizontalGrid")
        .data(this.yScale.ticks(4)).enter()
        .append("line")
        .attr(
            {
              "class":"horizontalGrid",
        "x1" : 0,
        "x2" : options.width - options.circler,
        "y1" : function(d){ return self.yScale(d);},
        "y2" : function(d){ return self.yScale(d);},
            });
    }

    // setup fill color
    var cValue = function(d) { return d.species_name;},
        color = d3.scale.category10();

    // Create view clipper for plot items (so they don't go past bounds of axes)
    // Create and plot line on plotview
    var clipper = this.svg.append('g')
      .attr('class', 'plotview')
      .attr('clip-path', 'url(#' + options.id + '-clipper)');

    this.updatePlot = function() {
      var plots = clipper.selectAll('g')
        .data(options.data);
      plots
        .enter()
        .append('g')
        .attr('class', 'plot');

      plots.each(updateSeries);
    }
    function updateSeries(g,i) {
      // Add unique shapes based on i if have time.
      var circle = d3.select(this).selectAll(".shadow")
        .data(g);
      circle.exit().remove();
      circle.enter()
        .append('circle')
        .attr("class", "shadow")
        .attr("r", options.circler)
        .attr("filter", "url(#blur)")
      circle
        .classed("yellow", function(d){ return d.contributor_id == contributor_id; })
        .classed("gray", function(d){ return d.contributor_id != contributor_id; })
        .transition().duration(200).ease("linear")
        .attr("cx", function(d) { return self.xScale(d.date); })
        .attr("cy", function(d) { return self.yScale(d.day); });
      circle = d3.select(this).selectAll(".dot")
        .data(g);
      circle.exit().remove();
      circle.enter()
        .append('circle')
        .attr("class", "dot")
        .attr("r", options.circler)
        .style("fill", function(d) { return color(cValue(d));})
        .on("mouseover", function(d) {
          tooltip.transition()
          .duration(200)
          .style("opacity", .9);
        tooltip.html(d.species_name + "<br/> (" + d3.time.format("%x")(d.date)
          + ", " + d3.time.format("%b. %d")(d.day) + ")")
          .style("left", (d3.event.pageX + 5) + "px")
          .style("top", (d3.event.pageY - 28) + "px");
        })
      .on("mouseout", function(d) {
        tooltip.transition()
        .duration(500)
        .style("opacity", 0);
      });
        // .style('opacity', 0.5)
        // .transition().duration(200)
        // .style('opacity', 1);
      circle
        .transition().duration(200).ease("linear")
        .attr("cx", function(d) { return self.xScale(d.date); })
        .attr("cy", function(d) { return self.yScale(d.day); });

      var xvals = g.map(function(d){return d.date;});
      var yvals = g.map(function(d){return +d.day;});

      if (xvals.length > 1) {
        var xSeries = d3.range(1, xvals.length + 1);
        var ySeries = yvals; /* d3.range(1, yvals.length + 1); */
        var leastSquaresCoeff = leastSquares(xSeries, ySeries);
        // apply the reults of the least squares regression
        var x1 = xvals[0];
        var y1 = leastSquaresCoeff[0] + leastSquaresCoeff[1];
        var x2 = xvals[xvals.length - 1];
        var y2 = leastSquaresCoeff[0] * xSeries.length + leastSquaresCoeff[1];
        var trendData = [[x1,new Date(y1),x2,new Date(y2)]];

        var trendline = d3.select(this).selectAll(".trendline")
          .data(trendData);
        trendline.enter()
          .append("line")
          .attr("class", "trendline")
          .style("stroke", function(d) { return color(g[0].species_name);});
        trendline
          .transition().duration(500).ease("linear")
          .attr("x1", function(d) { return self.xScale(d[0]); })
          .attr("y1", function(d) { return self.yScale(d[1]); })
          .attr("x2", function(d) { return self.xScale(d[2]); })
          .attr("y2", function(d) { return self.yScale(d[3]); });
      }

      if (options.haslegend) {
        // draw legend
        var legend = self.svg.selectAll(".legend")
          .data(color.domain())
          .enter().append("g")
          .attr("class", "legend")
          .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

        // draw legend colored rectangles
        legend.append("rect")
          .attr("x", options.width - 18)
          .attr("width", 18)
          .attr("height", 18)
          .style("fill", color);

        // draw legend text
        legend.append("text")
          .attr("x", options.width - 24)
          .attr("y", 9)
          .attr("dy", ".35em")
          .style("text-anchor", "end")
          .text(function(d) { return d;});
      }
    };
    this.updatePlot();

    // add the tooltip area to the webpage
    if (options.hastooltip) {
      var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    }

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
        .attr("class", "brush normal")
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

    // returns slope, intercept and r-square of the line
    function leastSquares(xSeries, ySeries) {
      var reduceSumFunc = function(prev, cur) { return prev + cur; };

      var xBar = xSeries.reduce(reduceSumFunc) * 1.0 / xSeries.length;
      var yBar = ySeries.reduce(reduceSumFunc) * 1.0 / ySeries.length;

      var ssXX = xSeries.map(function(d) { return Math.pow(d - xBar, 2); })
        .reduce(reduceSumFunc);

      var ssYY = ySeries.map(function(d) { return Math.pow(d - yBar, 2); })
        .reduce(reduceSumFunc);

      var ssXY = xSeries.map(function(d, i) { return (d - xBar) * (ySeries[i] - yBar); })
        .reduce(reduceSumFunc);

      var slope = ssXY / ssXX;
      var intercept = yBar - (xBar * slope);
      var rSquare = Math.pow(ssXY, 2) / (ssXX * ssYY);

      return [slope, intercept, rSquare];
    }
}
