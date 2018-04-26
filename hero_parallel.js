// Parallel Coordinates
// Copyright (c) 2012, Kai Chang
// Released under the BSD License: http://opensource.org/licenses/BSD-3-Clause

var width = document.body.clientWidth,
    height = d3.max([document.body.clientHeight-540, 240]);

var m = [60, 0, 10, 0], // margin
    w = width - m[1] - m[3], // width
    h = height - m[0] - m[2], // height
    xscale = d3.scale.ordinal().rangePoints([0, w], 1),
    yscale = {},
    dragging = {},
    axes = {}, // Each axes object (because each one will need its own labels)
    data, // Loaded in data
    foreground,
    background,
    highlighted,
    dimensions,
    legend, // Legend
    render_speed = 50,
    brush_count = 0,
    group = 'world'
    excluded_groups = []; // The things that need to be excludeded

// Scale chart and canvas height
d3.select("#chart")
    .style("height", (h + m[0] + m[2]) + "px")

d3.selectAll("canvas")
    .attr("width", w)
    .attr("height", h)
    .style("padding", m.join("px ") + "px");

// Foreground canvas
foreground = document.getElementById('foreground').getContext('2d');
foreground.globalCompositeOperation = "destination-over";
foreground.strokeStyle = "rgba(0,100,160,0.1)";
foreground.lineWidth = 1.7;
foreground.fillText("Loading...",w/2,h/2);

// Highlight canvas for temporary interactions
highlighted = document.getElementById('highlight').getContext('2d');
highlighted.strokeStyle = "rgba(0,100,160,1)";
highlighted.lineWidth = 4;

// Background canvas
background = document.getElementById('background').getContext('2d');
background.strokeStyle = "rgba(0,100,160,0.1)";
background.lineWidth = 1.7;

var colors = {
  "Marvel": [241,31,34],
  "DC": [0,120,240]
};

var svg = d3.select("svg")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
    .append("svg:g")
    .attr("transform", "translate(" + m[3] + "," + m[0] + ")");


function process_raw_comics(raw_data) {
    return raw_data.map(function(d) {
        for (var k in d) {
            // Integers
            if (!_.isNaN(raw_data[0][k]) && k == 'YEAR') {
                d[k] = parseInt(d[k]) || 2014;
            }
            if (!_.isNaN(raw_data[0][k]) && _.contains(['SEX_id', 'ALIGN_id', 'GSM_id', 'ALIVE_id', 'ID_id'], k)) {
                d[k] = parseFloat(d[k]) || 0;
            }
        };

        return d;
    });
}

d3.csv("comic_data_2.csv", function(raw_data) {
    // Raw data comes back as list of dictionaries with values all being strings
    data = process_raw_comics(raw_data);

    dimensions = d3.keys(data[0])
        .filter(function(k) {
            return _.isNumber(data[0][k]);
        }).map(function(k) {
            yscale[k] = d3.scale.linear()
                .domain(d3.extent(data, function(d) { return +d[k]; }))
                .range([h, 0]);
            return k
        }).sort()

    xscale.domain(dimensions);

    ["ALIGN", "ALIVE", "GSM", "SEX", "ID"].forEach(function(k) {
        var vals = d3.nest()
                .key(function(d) { return [Math.round(d[k + '_id'], 0), d[k]]; })
                .entries(data)
                .map(function(d) {return d.key});

        var dict = {};

        vals.forEach(function(v) {
            var parts = v.split(',');
            dict[parseInt(parts[0])] = parts[1];
        });

        axes[k + '_id'] = d3.svg.axis()
            .orient("left")
            .scale(yscale[k + '_id'])
            .tickValues(_.keys(dict))
            .tickFormat(function(d, i) { return dict[d]});
    });

    axes['YEAR'] = d3.svg.axis()
        .orient("left")
        .scale(yscale['YEAR'])
        .ticks(1+height/50)
        .tickFormat(function(d, i) { return String(d)});

    var g = svg.selectAll(".dimension")
        .data(dimensions)
        .enter().append("svg:g")
            .attr("class", "dimension")
            .attr("transform", function(d) { return "translate(" + xscale(d) + ")"; })
            .call(d3.behavior.drag()
            .on("dragstart", function(d) {
                    dragging[d] = this.__origin__ = xscale(d);
                    this.__dragged__ = false;
                    d3.select("#foreground").style("opacity", "0.35");
               })
            .on("drag", function(d) {
                    dragging[d] = Math.min(w, Math.max(0, this.__origin__ += d3.event.dx));
                    dimensions.sort(function(a, b) { return position(a) - position(b); });
                    xscale.domain(dimensions);
                    g.attr("transform", function(d) { return "translate(" + position(d) + ")"; });
                    brush_count++;
                    this.__dragged__ = true;

                    // Feedback for axis deletion if dropped
                    if (dragging[d] < 12 || dragging[d] > w-12) {
                      d3.select(this).select(".background").style("fill", "#b00");
                    } else {
                      d3.select(this).select(".background").style("fill", null);
                    }
                })
            .on("dragend", function(d) {
                    if (!this.__dragged__) {
                      // no movement, invert axis
                      var extent = invert_axis(d);

                    } else {
                      // reorder axes
                      d3.select(this).transition().attr("transform", "translate(" + xscale(d) + ")");

                      var extent = yscale[d].brush.extent();
                    }

                    // remove axis if dragged all the way left
                    if (dragging[d] < 12 || dragging[d] > w-12) {
                      remove_axis(d,g);
                    }

                    // TODO required to avoid a bug
                    xscale.domain(dimensions);
                    update_ticks(d, extent);

                    // rerender
                    d3.select("#foreground").style("opacity", null);
                    brush();
                    delete this.__dragged__;
                    delete this.__origin__;
                    delete dragging[d];
                })
            );

    // Add an axis and title.
    g.append("svg:g")
        .attr("class", "axis")
        .attr("transform", "translate(0,0)")
        .each(function(d) { d3.select(this).call(axes[d]); })
        .append("svg:text")
        .attr("text-anchor", "middle")
        .attr("y", function(d,i) { return i%2 == 0 ? -14 : -30 } )
        .attr("x", 0)
        .attr("class", "label")
        .text(String)
        .append("title")
        .text("Click to invert. Drag to reorder");

    // Add and store a brush for each axis.
    g.append("svg:g")
        .attr("class", "brush")
        .each(function(d) { d3.select(this).call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush)); })
        .selectAll("rect")
        .style("visibility", null)
        .attr("x", -23)
        .attr("width", 36)
        .append("title")
        .text("Drag up or down to brush along this axis");

    g.selectAll(".extent")
        .append("title")
        .text("Drag or resize this filter");

    brush();
});

function brush_helper(p) {
    return yscale[p].brush.extent();
}

// Handles a brush event, toggling the display of foreground lines.
// TODO refactor
// Draws the lines at least
// Done on any event that changes excluded group
function brush() {
    /*
    var selected = yScale
        .domain()
        .filter(function(d) {return (brush.extent()[0] <= yScale(d)) && (yScale(d) <= brush.extent()[1])});
    */
    brush_count++;
    var actives = dimensions.filter(function(p) { return !yscale[p].brush.empty(); }),
        extents = actives.map(function(p) { return yscale[p].brush.extent(); });

    // hack to hide ticks beyond extent
    var b = d3.selectAll('.dimension')[0]
        .forEach(function(element, i) {
            var dimension = d3.select(element).data()[0];
            if (_.include(actives, dimension)) {
                var extent = extents[actives.indexOf(dimension)];
                d3.select(element)
                    .selectAll('text')
                        .style('font-weight', 'bold')
                        .style('font-size', '13px')
                        .style('display', function() {
                            var value = d3.select(this).data();
                            return extent[0] <= value && value <= extent[1] ? null : "none"
                        });
            } else {
                d3.select(element)
                    .selectAll('text')
                        .style('font-size', null)
                        .style('font-weight', null)
                        .style('display', null);
            }
                d3.select(element)
                    .selectAll('.label')
                        .style('display', null);
        });

    // bold dimensions with label
    d3.selectAll('.label')
        .style("font-weight", function(dimension) {
            if (_.include(actives, dimension)) return "bold";
            return null;
        });

    // Get lines within extents
    var selected = [];
    data.filter(function(d) {
            return !_.contains(excluded_groups, d[group]);
        }).map(function(d) {
                return actives.every(function(p, dimension) {
                    return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1];
                }) ? selected.push(d) : null;
        });

    // free text search
    var query = d3.select("#search")[0][0].value;
    if (query.length > 0) {
        selected = search(selected, query);
    }

    if (selected.length < data.length && selected.length > 0) {
        d3.select("#keep-data").attr("disabled", null);
        d3.select("#exclude-data").attr("disabled", null);
    } else {
        d3.select("#keep-data").attr("disabled", "disabled");
        d3.select("#exclude-data").attr("disabled", "disabled");
    };

    // Render selected lines
    paths(selected, foreground, brush_count, true);
}

// render a set of polylines on a canvas
// Called anytime brush is called
function paths(selected, ctx, count) {
    var i = 0,
        n = selected.length,
        opacity = d3.min([2/Math.pow(n,0.3),1]),
        timer = (new Date()).getTime();

    var shuffled_data = _.shuffle(selected);

    data_table(shuffled_data.slice(0,25));
    selection_stats(opacity, n, data.length)

    ctx.clearRect(0,0,w+1,h+1);

    // render all lines until finished or a new brush event
    // How does this work when brushing?
    // Shouldn't brush force a restart for brushing
    // WTF. It's broken on V3 so, I'll try to fix.
    function animloop() {
        if (i >= n || count < brush_count) return true;
        var max = d3.min([i+render_speed, n]);
        render_range(shuffled_data, i, max, opacity);
        render_stats(max,n,render_speed);
        i = max;
        timer = optimize(timer);  // adjusts render_speed
    };

    d3.timer(animloop);
}

// Draws a observation's line to ctx
function path(d, ctx, color) {
    if (color) ctx.strokeStyle = color;
    ctx.beginPath();
    var x0 = xscale(dimensions[0])-15,
        y0 = yscale[dimensions[0]](d[dimensions[0]]);   // left edge

    ctx.moveTo(x0,y0);
    dimensions.map(function(p,i) {

        var x = xscale(p),
            y = yscale[p](d[p]);

        var cp1x = x - 0.88*(x-x0);
        var cp1y = y0;
        var cp2x = x - 0.12*(x-x0);
        var cp2y = y;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);

        x0 = x;
        y0 = y;
    });

    ctx.lineTo(x0+15, y0); // right edge
    ctx.stroke();
};


// Gives the list of heros names
function data_table(sample) {
    // sort by first column
    var sample = sample.sort(function(a,b) {
        var col = d3.keys(a)[0];
        return a[col] < b[col] ? -1 : 1;
    });

    var table = d3.select("#hero-list")
        .html("")
        .selectAll(".row")
        .data(sample)
        .enter().append("div")
            .on("mouseover", highlight)
            .on("mouseout", unhighlight);

    table.append("span")
        .attr("class", "color-block")
        .style("background", function(d) { return color(d[group],0.85) })

    table.append("span")
        .text(function(d) { return d.name; })
}

// Highlight single polyline
function highlight(d) {
    if (d['world'] == "Marvel") {
        var link = "http://marvel.wikia.com" + d['urlslug'];
    } else {
        var link = "http://dc.wikia.com" + d['urlslug'];
    }
    html_text = ["<a href =" + link + ' target="_blank"><b>' + d['name'] + "</b></a>",
                 "Sex: " + d['SEX'],
                 "Eye Color: " + d['EYE'],
                 "Hair Color: " + d['HAIR'],
                 "Year Made: " + d['YEAR'],
                 "Number Of Appearances: " + d['APPEARANCES'],
                 "Alive Status: " + d['ALIVE'],
                 "Sexual Orientation: " + d['GSM'],
                 "Alignment: " + d['ALIGN'],
                 "ID Status: " + d['ID']].join('<br>')

    d3.selectAll('#hero-info')
        .html(html_text)
    d3.select("#foreground").style("opacity", "0.25");
    d3.selectAll(".row").style("opacity", function(p) { return (d[group] == p) ? null : "0.3" });
    path(d, highlighted, color(d[group],1));
}

// Remove highlight
function unhighlight() {
    d3.select("#foreground").style("opacity", null);
    d3.selectAll(".row").style("opacity", null);
    highlighted.clearRect(0,0,w,h);
}

// Feedback on rendering progress
function render_stats(i,n,render_speed) {
    d3.select("#rendered-count").text(i);
    d3.select("#rendered-bar")
        .style("width", (100*i/n) + "%");
    d3.select("#render-speed").text(render_speed);
}

// Feedback on selection
function selection_stats(opacity, n, total) {
    d3.select("#data-count").text(total);
    d3.select("#selected-count").text(n);
    d3.select("#selected-bar").style("width", (100*n/total) + "%");
    d3.select("#opacity").text((""+(opacity*100)).slice(0,4) + "%");
}

function render_range(selection, i, max, opacity) {
    selection.slice(i,max).forEach(function(d) {
        path(d, foreground, color(d[group],opacity));
    });
};

// transition ticks for reordering, rescaling and inverting
function update_ticks(d, extent) {
    // update brushes
    if (d) {
        var brush_el = d3.selectAll(".brush")
            .filter(function(key) { return key == d; });
        // single tick
        if (extent) {
            // restore previous extent
            brush_el.call(yscale[d].brush = d3.svg.brush().y(yscale[d]).extent(extent).on("brush", brush));
        } else {
            brush_el.call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush));
        }
    } else {
        // all ticks
        d3.selectAll(".brush")
            .each(function(d) { d3.select(this).call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush)); })
    }

    brush_count++;

    show_ticks();

    // update axes
    d3.selectAll(".axis")
        .each(function(d,i) {
            // hide lines for better performance
            d3.select(this).selectAll('line').style("display", "none");

            // transition axis numbers
            d3.select(this)
                .transition()
                .duration(720)
                .call(axes[d]);

            // bring lines back
            d3.select(this).selectAll('line').transition().delay(800).style("display", null);

            d3.select(this)
                .selectAll('text')
                    .style('font-weight', null)
                    .style('font-size', null)
                    .style('display', null);
        });
}

// Rescale to new dataset domain
function rescale() {
    // reset yscales, preserving inverted state
    dimensions.forEach(function(d,i) {
        if (yscale[d].inverted) {
            yscale[d] = d3.scale.linear()
                .domain(d3.extent(data, function(p) { return +p[d]; }))
                .range([0, h]);
            yscale[d].inverted = true;
        } else {
            yscale[d] = d3.scale.linear()
                .domain(d3.extent(data, function(p) { return +p[d]; }))
                .range([h, 0]);
        }
    });

    update_ticks();

    paths(data, foreground, brush_count);
}

// Get polylines within extents
function actives() {
    var actives = dimensions.filter(function(p) { return !yscale[p].brush.empty(); }),
        extents = actives.map(function(p) { return yscale[p].brush.extent(); });

    // filter extents and excluded groups
    var selected = [];
    data.filter(function(d) {
            return !_.contains(excluded_groups, d[group]);
        }).map(function(d) {
            return actives.every(function(p, i) {
                    return extents[i][0] <= d[p] && d[p] <= extents[i][1];
                }) ? selected.push(d) : null;
        });

    // free text search
    var query = d3.select("#search")[0][0].value;
    if (query > 0) {
        selected = search(selected, query);
    }

    return selected;
}

// Export data
function export_csv() {
    var keys = d3.keys(data[0]);
    var rows = actives().map(function(row) {
        return keys.map(function(k) { return row[k]; })
    });

    var csv = d3.csv.format([keys].concat(rows)).replace(/\n/g,"<br/>\n");
    var styles = "<style>body { font-family: sans-serif; font-size: 12px; }</style>";
    window.open("text/csv").document.write(styles + csv);
}

// Remove all but selected from the dataset
function keep_data() {
    new_data = actives();
    if (new_data.length == 0) {
        alert("I don't mean to be rude, but I can't let you remove all the data.\n\nTry removing some brushes to get your data back. Then click 'Keep' when you've selected data you want to look closer at.");
        return false;
    }

    data = new_data;
    rescale();
}

// Exclude selected from the dataset
function exclude_data() {
    new_data = _.difference(data, actives());
    if (new_data.length == 0) {
        alert("I don't mean to be rude, but I can't let you remove all the data.\n\nTry selecting just a few data points then clicking 'Exclude'.");
        return false;
    }
    data = new_data;
    rescale();
}

function remove_axis(d,g) {
    dimensions = _.difference(dimensions, [d]);
    xscale.domain(dimensions);
    g.attr("transform", function(p) { return "translate(" + position(p) + ")"; });
    g.filter(function(p) { return p == d; }).remove();
    update_ticks();
}

d3.select("#keep-data").on("click", keep_data);
d3.select("#exclude-data").on("click", exclude_data);
d3.select("#export-data").on("click", export_csv);
d3.select("#search").on("keyup", brush);


// Appearance toggles
d3.select("#hide-ticks").on("click", hide_ticks);
d3.select("#show-ticks").on("click", show_ticks);

function hide_ticks() {
    d3.selectAll(".axis g").style("display", "none");
    //d3.selectAll(".axis path").style("display", "none");
    d3.selectAll(".background").style("visibility", "hidden");
    d3.selectAll("#hide-ticks").attr("disabled", "disabled");
    d3.selectAll("#show-ticks").attr("disabled", null);
};

function show_ticks() {
    d3.selectAll(".axis g").style("display", null);
    //d3.selectAll(".axis path").style("display", null);
    d3.selectAll(".background").style("visibility", null);
    d3.selectAll("#show-ticks").attr("disabled", "disabled");
    d3.selectAll("#hide-ticks").attr("disabled", null);
};

function search(selection,str) {
    pattern = new RegExp(str,"i")
    return _(selection).filter(function(d) { return pattern.exec(d.name); });
}

function selection_stats(opacity, n, total) {
    d3.select("#data-count").text(total);
    d3.select("#selected-count").text(n);
    d3.select("#selected-bar").style("width", (100*n/total) + "%");
    d3.select("#opacity").text((""+(opacity*100)).slice(0,4) + "%");
}

function color(d,a) {
    var c = colors[d];
    return ["rgba(",c[0],",",c[1],",",c[2],",",a,")"].join("");
}

function position(d) {
    var v = dragging[d];
    return v == null ? xscale(d) : v;
}

// Adjusts rendering speed
function optimize(timer) {
    var delta = (new Date()).getTime() - timer;
    render_speed = Math.max(Math.ceil(render_speed * 60 / delta), 8);
    render_speed = Math.min(render_speed, 300);
    return (new Date()).getTime();
}

function invert_axis(d) {
    // save extent before inverting
    if (!yscale[d].brush.empty()) {
        var extent = yscale[d].brush.extent();
    }

    if (yscale[d].inverted == true) {
        yscale[d].range([h, 0]);
        d3.selectAll('.label')
            .filter(function(p) { return p == d; })
            .style("text-decoration", null);

        yscale[d].inverted = false;
    } else {
        yscale[d].range([0, h]);
        d3.selectAll('.label')
            .filter(function(p) { return p == d; })
            .style("text-decoration", "underline");

        yscale[d].inverted = true;
    }

    return extent;
}
// scale to window size
window.onresize = function() {
    width = document.body.clientWidth,
    height = d3.max([document.body.clientHeight-500, 220]);

    w = width - m[1] - m[3],
    h = height - m[0] - m[2];

    d3.select("#chart")
        .style("height", (h + m[0] + m[2]) + "px")

    d3.selectAll("canvas")
        .attr("width", w)
        .attr("height", h)
        .style("padding", m.join("px ") + "px");

    d3.select("svg")
        .attr("width", w + m[1] + m[3])
        .attr("height", h + m[0] + m[2])
        .select("g")
            .attr("transform", "translate(" + m[3] + "," + m[0] + ")");

    xscale = d3.scale.ordinal().rangePoints([0, w], 1).domain(dimensions);
    dimensions.forEach(function(d) {
        yscale[d].range([h, 0]);
    });

    d3.selectAll(".dimension")
        .attr("transform", function(d) { return "translate(" + xscale(d) + ")"; })

    // update brush placement
    d3.selectAll(".brush")
        .each(function(d) { d3.select(this).call(yscale[d].brush = d3.svg.brush().y(yscale[d]).on("brush", brush)); })

    brush_count++;

    // update axis placement
    d3.selectAll(".axis")
        .each(function(d) { d3.select(this).call(axes[d]); });

    // render data
    brush();
};
