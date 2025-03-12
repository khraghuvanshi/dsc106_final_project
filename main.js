document.addEventListener("DOMContentLoaded", function () {
  // Initialize Scrollama
  const scroller = scrollama();
  let chart; // Will hold our chart instance
  let lastStepIndex = -1; // Track the last active step

  // Set up Scrollama steps
  scroller
    .setup({
      step: ".step", // Elements that trigger visualization updates
      offset: 0.5, // Trigger when step is 50% in view
      debug: false, // Set to true for debugging
    })
    .onStepEnter((response) => {
      // Update active step
      document.querySelectorAll(".step").forEach((el) => {
        el.classList.remove("is-active");
      });
      response.element.classList.add("is-active");

      // Update visualization based on current step and direction
      if (chart) {
        const isScrollingDown = response.direction === "down";
        const isScrollingUp = response.direction === "up";

        // Store the current step index for reference
        const currentIndex = response.index;

        updateVisualization(
          currentIndex,
          isScrollingDown,
          isScrollingUp,
          lastStepIndex
        );
        lastStepIndex = currentIndex;
      }
    });

  // Handle window resize
  window.addEventListener("resize", scroller.resize);

  // Chart initialization and update functions
  function initializeChart() {
    // Load data
    d3.csv("CGMacros_merge.csv").then(function (data) {
      // Convert data types
      data.forEach((d) => {
        d.Timestamp = new Date(d.Timestamp);
        d["Libre GL"] = +d["Libre GL"];
        d["Dexcom GL"] = +d["Dexcom GL"];
        d["Meal Type"] = d["Meal Type"];
        d["Calories"] = +d["Calories"];
        d["Carbs"] = +d["Carbs"];
        d["Protein"] = +d["Protein"];
        d["Fat"] = +d["Fat"];
        d["Fiber"] = +d["Fiber"];
        d["Amount Consumed"] = +d["Amount Consumed"];
      });

      // Get unique participants for dropdown
      let participants = [...new Set(data.map((d) => d.Participant_ID))];

      // Populate dropdown
      let dropdown = d3.select("#participantDropdown");
      dropdown
        .selectAll("option")
        .data(participants)
        .enter()
        .append("option")
        .text((d) => d);

      // Set up chart dimensions
      const svg = d3.select("#glucoseChart"),
        width = +svg.attr("width"),
        height = +svg.attr("height"),
        margin = { top: 20, right: 50, bottom: 50, left: 70 };

      // Clear existing SVG content
      svg.selectAll("*").remove();

      // Set up scales
      const xScale = d3.scaleTime().range([margin.left, width - margin.right]);
      const yScale = d3
        .scaleLinear()
        .range([height - margin.bottom, margin.top]);

      // Add axes groups
      const xAxis = svg
        .append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height - margin.bottom})`);

      const yAxis = svg
        .append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left},0)`);

      // Add axis labels
      svg
        .append("text")
        .attr("class", "x-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height - 10)
        .text("Time");

      svg
        .append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 20)
        .text("Glucose Level (mg/dL)");

      // Set up line generator
      const line = d3
        .line()
        .x((d) => xScale(d.Timestamp))
        .y((d) => yScale(d["Libre GL"]));

      // Create clipping path
      svg
        .append("defs")
        .append("clipPath")
        .attr("id", "chart-clip")
        .append("rect")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom);

      // Create a group for chart content
      const chartContent = svg
        .append("g")
        .attr("clip-path", "url(#chart-clip)");

      // Create a specific group for lines (below points)
      const lineGroup = chartContent.append("g").attr("class", "line-group");

      // Create a specific group for points (above lines)
      const pointGroup = chartContent.append("g").attr("class", "point-group");

      // Create tooltip
      const tooltip = d3.select(".tooltip");

      // Initialize participant and data variables
      let currentParticipant = participants[0];
      let filteredData = [];
      let originalData = [];
      let mealIndices = [];
      let mealData = [];
      let isZoomed = false;
      let lineSegments = []; // Store line segments data for zooming
      let linesCreated = false; // Track if lines have been created

      // Store chart components for updates
      chart = {
        svg,
        xScale,
        yScale,
        xAxis,
        yAxis,
        line,
        chartContent,
        lineGroup,
        pointGroup,
        tooltip,
        data,
        participants,
        currentParticipant,
        filteredData,
        originalData,
        mealIndices,
        mealData,
        isZoomed,
        lineSegments,
        updateData,
        margin,
        width,
        height,
        linesCreated,
      };

      // Initial data update
      updateData(currentParticipant);

      // Update visualization for current step (will be 0 initially)
      updateVisualization(0, true, false, -1);

      // Set up dropdown event listener
      dropdown.on("change", function () {
        chart.currentParticipant = this.value;
        updateData(chart.currentParticipant);

        // Re-apply current visualization state
        const activeStepIndex = Array.from(
          document.querySelectorAll(".step")
        ).findIndex((step) => step.classList.contains("is-active"));

        const stepIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
        updateVisualization(stepIndex, true, false, stepIndex - 1);
      });

      // Add click listener to reset zoom
      svg.on("dblclick", (event) => {
        if (chart.isZoomed) {
          resetZoom();
          // Re-apply current visualization state
          const activeStepIndex = Array.from(
            document.querySelectorAll(".step")
          ).findIndex((step) => step.classList.contains("is-active"));
          updateVisualization(
            activeStepIndex >= 0 ? activeStepIndex : 0,
            false,
            false,
            activeStepIndex
          );
        }
      });
    });
  }

  // Function to update data for a specific participant
  function updateData(participant) {
    // Clear all existing elements first
    chart.pointGroup.selectAll(".dot").remove();
    chart.lineGroup.selectAll(".line-segment").remove();

    chart.filteredData = chart.data.filter(
      (d) => d.Participant_ID === participant
    );
    chart.originalData = [...chart.filteredData]; // Store a copy of the original data

    // Get meal indices
    chart.mealIndices = chart.filteredData
      .map((d, i) =>
        d["Meal Type"] && d["Meal Type"].trim() !== "" ? i : null
      )
      .filter((i) => i !== null);

    // Get meal data points
    chart.mealData = chart.filteredData.filter(
      (d) => d["Meal Type"] && d["Meal Type"].trim() !== ""
    );

    // Update scales
    chart.xScale.domain(d3.extent(chart.filteredData, (d) => d.Timestamp));
    chart.yScale.domain([
      d3.min(chart.filteredData, (d) => d["Libre GL"]) - 10,
      d3.max(chart.filteredData, (d) => d["Libre GL"]) + 10,
    ]);

    // Update axes
    chart.xAxis.call(d3.axisBottom(chart.xScale).ticks(5));
    chart.yAxis.call(d3.axisLeft(chart.yScale));

    // Reset zoom state when changing participants
    chart.isZoomed = false;
    chart.lineSegments = [];
    chart.linesCreated = false; // Reset lines created flag
  }

  // Function to update visualization based on scroll step and direction
  function updateVisualization(
    stepIndex,
    isScrollingDown,
    isScrollingUp,
    lastStepIndex
  ) {
    if (!chart) return;

    // Always show axes from step 0 onwards
    if (stepIndex >= 0) {
      d3.selectAll(".x-axis, .y-axis").classed("show-element", true);
    } else {
      d3.selectAll(".x-axis, .y-axis").classed("show-element", false);
    }

    // Step 0: Show only the axes
    if (stepIndex === 0) {
      // Just show the axes
      if (isScrollingUp && lastStepIndex > 0) {
        // If scrolling up from step 1+, animate points/lines out
        chart.pointGroup
          .selectAll(".dot")
          .transition()
          .duration(500)
          .attr("cy", -10)
          .style("opacity", 0)
          .remove();

        chart.lineGroup
          .selectAll(".line-segment")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.linesCreated = false;
      }
    }

    // Step 1: Show only the axes with more context
    else if (stepIndex === 1) {
      // Just show the axes with updated labels
      if (isScrollingUp && lastStepIndex > 1) {
        // If scrolling up from step 2+, animate points/lines out
        chart.pointGroup
          .selectAll(".dot")
          .transition()
          .duration(500)
          .attr("cy", -10)
          .style("opacity", 0)
          .remove();

        chart.lineGroup
          .selectAll(".line-segment")
          .transition()
          .duration(500)
          .style("opacity", 0)
          .remove();

        chart.linesCreated = false;
      }
    }

    // Step 2: Show meal points
    else if (stepIndex === 2) {
      if (isScrollingDown || (isScrollingUp && lastStepIndex > 2)) {
        // Handle points based on direction
        if (isScrollingDown) {
          // Remove existing line segments when scrolling down to step 2
          chart.lineGroup
            .selectAll(".line-segment")
            .transition()
            .duration(500)
            .style("opacity", 0)
            .remove();

          chart.linesCreated = false;

          // Create dots
          createPoints(true);
        } else if (isScrollingUp) {
          // If scrolling up from step 3, just remove line segments
          chart.lineGroup
            .selectAll(".line-segment")
            .transition()
            .duration(500)
            .style("opacity", 0)
            .remove();

          chart.linesCreated = false;

          // Make sure points are visible
          if (!chart.pointGroup.selectAll(".dot").size()) {
            createPoints(true);
          }
        }
      }
    }

    // Step 3 and 4: Show line segments connecting meal points
    else if (stepIndex >= 3) {
      // First ensure all points are visible
      if (!chart.pointGroup.selectAll(".dot").size()) {
        createPoints(false);
      }

      // Handle line segments based on direction
      if (!chart.linesCreated) {
        // Sort meal indices chronologically
        const sortedMealIndices = [...chart.mealIndices].sort((a, b) => a - b);
        chart.lineSegments = []; // Reset the line segments data

        // Draw line segments between meal points in sequence
        for (let i = 0; i < sortedMealIndices.length - 1; i++) {
          const startIndex = sortedMealIndices[i];
          const endIndex = sortedMealIndices[i + 1];
          const segmentData = chart.filteredData.slice(
            startIndex,
            endIndex + 1
          );

          // Store segment data for zooming
          chart.lineSegments.push(segmentData);

          // Create a path generator for animation
          const pathGenerator = d3
            .line()
            .x((d) => chart.xScale(d.Timestamp))
            .y((d) => chart.yScale(d["Libre GL"]));

          // Create line segment with starting position at the top
          const initialPathData = segmentData.map((d) => {
            return {
              Timestamp: d.Timestamp,
              "Libre GL": chart.yScale.domain()[0] - 20, // Start above the chart
            };
          });

          const path = chart.lineGroup
            .append("path")
            .datum(segmentData)
            .attr("class", "line-segment")
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 2)
            .attr("d", pathGenerator(initialPathData))
            .style("opacity", 0);

          // Animate the path dropping in - SLOWER ANIMATION
          path
            .transition()
            .delay(i * 50) // Increase delay
            .duration(1000) // Set to 1000ms (1 second)
            .attr("d", pathGenerator)
            .style("opacity", 1);

          // Add interaction after animation
          path
            .on("mouseover", function () {
              d3.select(this).attr("stroke-width", 4);
            })
            .on("mouseout", function () {
              d3.select(this).attr("stroke-width", 2);
            })
            .on("click", function (event, d) {
              event.stopPropagation();
              if (!chart.isZoomed) {
                zoomToSegment(d);
              }
            });
        }

        chart.linesCreated = true; // Mark lines as created
      }
    }
  }

  // Helper function to create points
  function createPoints(animate) {
    const sortedMealData = [...chart.mealData].sort(
      (a, b) => a.Timestamp - b.Timestamp
    );

    // Create dots
    const dots = chart.pointGroup
      .selectAll(".dot")
      .data(sortedMealData)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => chart.xScale(d.Timestamp))
      .attr("r", 5)
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);

    if (animate) {
      dots
        .attr("cy", -10) // Start from top
        .style("opacity", 0)
        .transition()
        .duration(500)
        .delay((d, i) => i * 20)
        .attr("cy", (d) => chart.yScale(d["Libre GL"]))
        .style("opacity", 1);
    } else {
      dots.attr("cy", (d) => chart.yScale(d["Libre GL"])).style("opacity", 1);
    }
  }

  // Tooltip functions
  function showTooltip(event, d) {
    // Get the browser's viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate initial tooltip position
    let xPos = event.clientX + 20;
    let yPos = event.clientY - 10;

    // Create the tooltip content
    const amountConsumed = Math.min(+d["Amount Consumed"] || 0, 100) / 100;
    const adjustedCalories = ((+d.Calories || 0) * amountConsumed).toFixed(2);
    const adjustedCarbs = ((+d.Carbs || 0) * amountConsumed).toFixed(2);
    const adjustedProtein = ((+d.Protein || 0) * amountConsumed).toFixed(2);
    const adjustedFat = ((+d.Fat || 0) * amountConsumed).toFixed(2);
    const adjustedFiber = ((+d.Fiber || 0) * amountConsumed).toFixed(2);

    const content = `
          <strong>${d["Meal Type"] || "Unknown Meal"}</strong><br>
          Calories: ${adjustedCalories}<br>
          Carbs: ${adjustedCarbs}g<br>
          Protein: ${adjustedProtein}g<br>
          Fat: ${adjustedFat}g<br>
          Fiber: ${adjustedFiber}g<br>
          Glucose: ${d["Libre GL"].toFixed(1)} mg/dL
        `;

    // First set content and make visible but off-screen for measurement
    chart.tooltip
      .html(content)
      .style("display", "block")
      .style("left", `${xPos}px`)
      .style("top", `${yPos}px`);

    // Get element dimensions after content is set
    const tooltipElement = chart.tooltip.node();
    const tooltipWidth = tooltipElement.offsetWidth;
    const tooltipHeight = tooltipElement.offsetHeight;

    // Highlight the point
    d3.select(this).transition().duration(200).attr("r", 8);
  }

  function hideTooltip() {
    chart.tooltip.style("display", "none");
    // Reset point size
    d3.select(this).transition().duration(200).attr("r", 5);
  }

  // Function to zoom to a specific segment
  function zoomToSegment(segmentData) {
    if (!segmentData || segmentData.length === 0) return;

    chart.isZoomed = true;

    // Update scales for zoomed view
    chart.xScale.domain(d3.extent(segmentData, (d) => d.Timestamp));
    chart.yScale.domain([
      d3.min(segmentData, (d) => d["Libre GL"]) - 10,
      d3.max(segmentData, (d) => d["Libre GL"]) + 10,
    ]);

    // Update axes with transition
    chart.xAxis
      .transition()
      .duration(250)
      .call(d3.axisBottom(chart.xScale).ticks(5));
    chart.yAxis.transition().duration(250).call(d3.axisLeft(chart.yScale));

    // Update line segments with transition
    chart.lineGroup
      .selectAll(".line-segment")
      .transition()
      .duration(250)
      .attr("d", (d) => {
        return d3
          .line()
          .x((d) => chart.xScale(d.Timestamp))
          .y((d) => chart.yScale(d["Libre GL"]))(d);
      });

    // Update dots with transition
    chart.pointGroup
      .selectAll(".dot")
      .transition()
      .duration(250)
      .attr("cx", (d) => chart.xScale(d.Timestamp))
      .attr("cy", (d) => chart.yScale(d["Libre GL"]));

    // Add double-click instruction
    chart.svg
      .append("text")
      .attr("class", "zoom-instruction")
      .attr("x", chart.width / 2)
      .attr("y", chart.margin.top + 20)
      .attr("text-anchor", "middle")
      .text("Double-click to reset zoom")
      .style("opacity", 0)
      .transition()
      .duration(500)
      .style("opacity", 1);
  }

  // Function to reset zoom
  function resetZoom() {
    chart.isZoomed = false;

    // Reset scales to original domain
    chart.xScale.domain(d3.extent(chart.originalData, (d) => d.Timestamp));
    chart.yScale.domain([
      d3.min(chart.originalData, (d) => d["Libre GL"]) - 10,
      d3.max(chart.originalData, (d) => d["Libre GL"]) + 10,
    ]);

    // Update axes with transition
    chart.xAxis
      .transition()
      .duration(250)
      .call(d3.axisBottom(chart.xScale).ticks(5));
    chart.yAxis.transition().duration(250).call(d3.axisLeft(chart.yScale));

    // Update line segments with transition
    chart.lineGroup
      .selectAll(".line-segment")
      .transition()
      .duration(250)
      .attr("d", (d) => {
        return d3
          .line()
          .x((d) => chart.xScale(d.Timestamp))
          .y((d) => chart.yScale(d["Libre GL"]))(d);
      });

    // Update dots with transition
    chart.pointGroup
      .selectAll(".dot")
      .transition()
      .duration(250)
      .attr("cx", (d) => chart.xScale(d.Timestamp))
      .attr("cy", (d) => chart.yScale(d["Libre GL"]));

    // Remove zoom instruction
    chart.svg.selectAll(".zoom-instruction").remove();
  }

  // Initialize chart
  initializeChart();
});
